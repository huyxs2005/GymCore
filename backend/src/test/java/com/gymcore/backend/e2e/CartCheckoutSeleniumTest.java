package com.gymcore.backend.e2e;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.bonigarcia.wdm.WebDriverManager;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

class CartCheckoutSeleniumTest {

    private static final String BASE_URL = "http://localhost:5173";
    private static final String CUSTOMER_EMAIL = "customer@gymcore.local";
    private static final String CUSTOMER_PASSWORD = "Customer123456!";
    private static final String PRODUCT_NAME = "Whey Protein";

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeEach
    void setUp() {
        WebDriverManager.chromedriver().setup();

        ChromeOptions options = new ChromeOptions();
        options.addArguments("--start-maximized");
        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(20));
    }

    @AfterEach
    void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }

    @Test
    void tcCart001_shouldOpenCartPageForAuthenticatedCustomer() {
        openPreparedCartPage();

        assertTrue(driver.getCurrentUrl().contains("/customer/cart"));
        assertTrue(checkoutButton().isDisplayed());
    }

    @Test
    void tcCart002_shouldDisplayInitialQuantityCorrectly() {
        openPreparedCartPage();

        assertEquals("1", getQuantityText(findCartItem(PRODUCT_NAME)));
    }

    @Test
    void tcCart003_shouldDisplayInitialSubtotalCorrectly() {
        openPreparedCartPage();

        WebElement cartItem = findCartItem(PRODUCT_NAME);
        long unitPrice = extractCurrencyValue(unitPriceText(cartItem).getText());
        long subtotal = extractCurrencyValue(subtotalBadge().getText());

        assertEquals(unitPrice, subtotal);
    }

    @Test
    void tcCart004_shouldIncreaseCartQuantityFromOneToTwo() {
        openPreparedCartPage();

        WebElement cartItem = findCartItem(PRODUCT_NAME);
        assertEquals("1", getQuantityText(cartItem));

        getIncreaseButton(cartItem).click();
        wait.until(d -> "2".equals(getQuantityText(findCartItem(PRODUCT_NAME))));

        assertEquals("2", getQuantityText(findCartItem(PRODUCT_NAME)));
    }

    @Test
    void tcCart005_shouldRecalculateLineTotalAfterIncreasingQuantity() {
        openPreparedCartPage();

        WebElement cartItem = findCartItem(PRODUCT_NAME);
        long unitPrice = extractCurrencyValue(unitPriceText(cartItem).getText());
        getIncreaseButton(cartItem).click();

        wait.until(d -> "2".equals(getQuantityText(findCartItem(PRODUCT_NAME))));
        wait.until(d -> extractCurrencyValue(lineTotalText(findCartItem(PRODUCT_NAME)).getText()) == unitPrice * 2);

        assertEquals(unitPrice * 2, extractCurrencyValue(lineTotalText(findCartItem(PRODUCT_NAME)).getText()));
    }

    @Test
    void tcCart006_shouldRecalculateSubtotalAfterIncreasingQuantity() {
        openPreparedCartPage();

        WebElement cartItem = findCartItem(PRODUCT_NAME);
        long unitPrice = extractCurrencyValue(unitPriceText(cartItem).getText());
        getIncreaseButton(cartItem).click();

        wait.until(d -> extractCurrencyValue(subtotalBadge().getText()) == unitPrice * 2);

        assertEquals(unitPrice * 2, extractCurrencyValue(subtotalBadge().getText()));
    }

    @Test
    void tcCart007_shouldSendUpdatedQuantityToBackendAfterIncreasingQuantity() {
        openPreparedCartPage();
        installBrowserInstrumentation();

        getIncreaseButton(findCartItem(PRODUCT_NAME)).click();
        waitForUpdateCartCalls(1);

        Map<String, Object> stats = getApiStats();
        assertTrue(String.valueOf(stats.get("lastPatchBody")).contains("\"quantity\":2"));
    }

    @Test
    void tcCart008_shouldCallUpdateCartApiExactlyOnceWhenIncreasingQuantityOnce() {
        openPreparedCartPage();
        installBrowserInstrumentation();

        getIncreaseButton(findCartItem(PRODUCT_NAME)).click();
        waitForUpdateCartCalls(1);

        Map<String, Object> stats = getApiStats();
        assertEquals(1L, asLong(stats.get("updateCartCalls")));
    }

    @Test
    void tcCheckout001_shouldShowCheckoutButtonForAuthenticatedCustomer() {
        openPreparedCartPage();

        assertTrue(checkoutButton().isDisplayed());
        assertTrue(checkoutButton().isEnabled());
    }

    @Test
    void tcCheckout002_shouldOpenRecipientModalWhenCheckoutIsClicked() {
        openPreparedCartPage();

        checkoutButton().click();

        WebElement modalHeading = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//h3[contains(normalize-space(.), 'Confirm receipt details')]")));
        assertNotNull(modalHeading);
    }

    @Test
    void tcCheckout003_shouldShowEditableRecipientFieldsInModal() {
        openPreparedCartPage();
        checkoutButton().click();

        WebElement fullNameInput = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector("input[placeholder='Account full name']")));
        WebElement phoneInput = driver.findElement(By.cssSelector("input[placeholder='Contact phone number']"));
        WebElement emailInput = driver.findElement(By.cssSelector("input[placeholder='Receipt email address']"));

        assertTrue(fullNameInput.isDisplayed() && fullNameInput.isEnabled());
        assertTrue(phoneInput.isDisplayed() && phoneInput.isEnabled());
        assertTrue(emailInput.isDisplayed() && emailInput.isEnabled());
    }

    @Test
    void tcCheckout004_shouldAcceptRecipientDetailsInModal() {
        openPreparedCartPage();
        checkoutButton().click();

        WebElement fullNameInput = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector("input[placeholder='Account full name']")));
        WebElement phoneInput = driver.findElement(By.cssSelector("input[placeholder='Contact phone number']"));
        WebElement emailInput = driver.findElement(By.cssSelector("input[placeholder='Receipt email address']"));

        fullNameInput.clear();
        fullNameInput.sendKeys("Customer Selenium");
        phoneInput.clear();
        phoneInput.sendKeys("0900999999");
        emailInput.clear();
        emailInput.sendKeys("customer.selenium@gymcore.local");

        assertEquals("Customer Selenium", fullNameInput.getAttribute("value"));
        assertEquals("0900999999", phoneInput.getAttribute("value"));
        assertEquals("customer.selenium@gymcore.local", emailInput.getAttribute("value"));
    }

    @Test
    void tcCheckout005_shouldSubmitCheckoutRequestSuccessfully() {
        openPreparedCartPage();
        installBrowserInstrumentation();
        openCheckoutModalAndFillRecipientInfo();

        confirmAndPayButton().click();
        waitForCheckoutCalls(1);

        Map<String, Object> stats = getApiStats();
        assertTrue(String.valueOf(stats.get("lastCheckoutBody")).contains("\"paymentMethod\":\"PAYOS\""));
        assertTrue(String.valueOf(stats.get("lastCheckoutBody")).contains("\"fullName\":\"Customer Selenium\""));
    }

    @Test
    void tcCheckout006_shouldRedirectToHostedCheckoutPageAfterSuccessfulCheckout() {
        openPreparedCartPage();
        installBrowserInstrumentation();
        preventRedirect();
        openCheckoutModalAndFillRecipientInfo();

        confirmAndPayButton().click();
        waitForCheckoutCalls(1);
        wait.until(d -> !String.valueOf(((JavascriptExecutor) d).executeScript("return window.__seleniumRedirectUrl || ''")).isBlank());

        String redirectUrl = String.valueOf(((JavascriptExecutor) driver).executeScript("return window.__seleniumRedirectUrl"));
        assertFalse(redirectUrl.isBlank());
        assertTrue(redirectUrl.startsWith("http"));
    }

    @Test
    void tcCheckout007_shouldCallCheckoutApiExactlyOnceWhenConfirmingCheckoutOnce() {
        openPreparedCartPage();
        installBrowserInstrumentation();
        preventRedirect();
        openCheckoutModalAndFillRecipientInfo();

        confirmAndPayButton().click();
        waitForCheckoutCalls(1);

        Map<String, Object> stats = getApiStats();
        assertEquals(1L, asLong(stats.get("checkoutCalls")));
    }

    @Test
    void tcCheckout008_shouldReachHostedCheckoutPageAfterRedirect() {
        openPreparedCartPage();
        openCheckoutModalAndFillRecipientInfo();

        confirmAndPayButton().click();
        wait.until(d -> !d.getCurrentUrl().contains("/customer/cart"));
        wait.until(d -> "complete".equals(((JavascriptExecutor) d).executeScript("return document.readyState")));

        assertTrue(driver.getCurrentUrl().startsWith("http"));
    }

    private void loginAsCustomer() {
        driver.get(BASE_URL + "/auth/login");

        WebElement emailInput = wait.until(
                ExpectedConditions.visibilityOfElementLocated(By.cssSelector("input[type='email']")));
        WebElement passwordInput = wait.until(
                ExpectedConditions.visibilityOfElementLocated(By.cssSelector("input[type='password']")));
        WebElement loginButton = wait.until(
                ExpectedConditions.elementToBeClickable(By.cssSelector("button[type='submit']")));

        emailInput.clear();
        emailInput.sendKeys(CUSTOMER_EMAIL);
        passwordInput.clear();
        passwordInput.sendKeys(CUSTOMER_PASSWORD);
        loginButton.click();

        wait.until(ExpectedConditions.urlToBe(BASE_URL + "/"));
    }

    @SuppressWarnings("unchecked")
    private void prepareCartWithSingleItem(String productName, int quantity) {
        Object result = ((JavascriptExecutor) driver).executeAsyncScript("""
                const productName = arguments[0];
                const quantity = arguments[1];
                const done = arguments[arguments.length - 1];
                const token = window.localStorage.getItem('gymcore_access_token');

                (async () => {
                  try {
                    if (!token) throw new Error('Missing access token.');

                    const authHeaders = { Authorization: `Bearer ${token}` };
                    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

                    const productsResponse = await fetch('/api/v1/products', { headers: authHeaders });
                    const productsPayload = await productsResponse.json();
                    const products = productsPayload?.data?.products || productsPayload?.data?.items || [];
                    const targetProduct = products.find((item) => item.name === productName) || products[0];
                    if (!targetProduct) throw new Error('No active product found.');

                    const cartResponse = await fetch('/api/v1/cart', { headers: authHeaders });
                    const cartPayload = await cartResponse.json();
                    const existingItems = cartPayload?.data?.items || [];

                    for (const item of existingItems) {
                      await fetch(`/api/v1/cart/items/${item.productId}`, {
                        method: 'DELETE',
                        headers: authHeaders,
                      });
                    }

                    await fetch('/api/v1/cart/items', {
                      method: 'POST',
                      headers: jsonHeaders,
                      body: JSON.stringify({ productId: targetProduct.productId, quantity }),
                    });

                    done({
                      ok: true,
                      productId: targetProduct.productId,
                      productName: targetProduct.name,
                    });
                  } catch (error) {
                    done({
                      ok: false,
                      error: String(error),
                    });
                  }
                })();
                """, productName, quantity);

        Map<String, Object> payload = (Map<String, Object>) result;
        assertTrue(Boolean.TRUE.equals(payload.get("ok")), String.valueOf(payload.get("error")));
    }

    private void openCartPage() {
        driver.get(BASE_URL + "/customer/cart");
        wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//p[contains(normalize-space(.), 'Cart items')]")));
        wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//button[contains(normalize-space(.), 'Checkout with PayOS')]")));
    }

    private void openPreparedCartPage() {
        loginAsCustomer();
        prepareCartWithSingleItem(PRODUCT_NAME, 1);
        openCartPage();
    }

    private void openCheckoutModalAndFillRecipientInfo() {
        checkoutButton().click();
        WebElement fullNameInput = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector("input[placeholder='Account full name']")));
        WebElement phoneInput = driver.findElement(By.cssSelector("input[placeholder='Contact phone number']"));
        WebElement emailInput = driver.findElement(By.cssSelector("input[placeholder='Receipt email address']"));

        fullNameInput.clear();
        fullNameInput.sendKeys("Customer Selenium");
        phoneInput.clear();
        phoneInput.sendKeys("0900999999");
        emailInput.clear();
        emailInput.sendKeys("customer.selenium@gymcore.local");

        wait.until(d -> confirmAndPayButton().isEnabled());
    }

    private WebElement findCartItem(String productName) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//article[.//p[contains(normalize-space(.), '" + productName + "')]]")));
    }

    private String getQuantityText(WebElement cartItem) {
        return cartItem.findElement(By.xpath(".//span[contains(@class,'min-w-[2rem]')]")).getText().trim();
    }

    private WebElement getIncreaseButton(WebElement cartItem) {
        return cartItem.findElement(By.xpath(".//button[normalize-space(.)='+']"));
    }

    private WebElement unitPriceText(WebElement cartItem) {
        return cartItem.findElement(By.xpath(".//p[contains(normalize-space(.), 'VND / unit')]"));
    }

    private WebElement lineTotalText(WebElement cartItem) {
        return cartItem.findElement(By.xpath(".//p[contains(normalize-space(.), 'VND') and not(contains(normalize-space(.), '/ unit'))]"));
    }

    private WebElement subtotalBadge() {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//header//div[contains(normalize-space(.), 'subtotal')]")));
    }

    private WebElement checkoutButton() {
        return wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//button[contains(normalize-space(.), 'Checkout with PayOS')]")));
    }

    private WebElement confirmAndPayButton() {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//button[contains(normalize-space(.), 'Confirm and pay')]")));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getApiStats() {
        return (Map<String, Object>) ((JavascriptExecutor) driver).executeScript("return window.__seleniumApiStats || {};");
    }

    private void waitForUpdateCartCalls(long expectedCalls) {
        wait.until(d -> asLong(getApiStats().get("updateCartCalls")) >= expectedCalls);
    }

    private void waitForCheckoutCalls(long expectedCalls) {
        wait.until(d -> asLong(getApiStats().get("checkoutCalls")) >= expectedCalls);
    }

    private void installBrowserInstrumentation() {
        ((JavascriptExecutor) driver).executeScript("""
                if (!window.__seleniumInstrumentationInstalled) {
                  window.__seleniumInstrumentationInstalled = true;
                  window.__seleniumApiStats = {
                    updateCartCalls: 0,
                    checkoutCalls: 0,
                    lastPatchBody: '',
                    lastCheckoutBody: ''
                  };
                  window.__seleniumPreventRedirect = false;
                  window.__seleniumRedirectUrl = '';

                  const originalOpen = XMLHttpRequest.prototype.open;
                  const originalSend = XMLHttpRequest.prototype.send;

                  XMLHttpRequest.prototype.open = function(method, url) {
                    this.__seleniumMethod = method;
                    this.__seleniumUrl = url;
                    return originalOpen.apply(this, arguments);
                  };

                  XMLHttpRequest.prototype.send = function(body) {
                    try {
                      const method = String(this.__seleniumMethod || '').toUpperCase();
                      const url = String(this.__seleniumUrl || '');
                      if (method === 'PATCH' && url.includes('/v1/cart/items/')) {
                        window.__seleniumApiStats.updateCartCalls += 1;
                        window.__seleniumApiStats.lastPatchBody = String(body || '');
                      }
                      if (method === 'POST' && url.includes('/v1/orders/checkout')) {
                        window.__seleniumApiStats.checkoutCalls += 1;
                        window.__seleniumApiStats.lastCheckoutBody = String(body || '');
                      }
                    } catch (error) {
                      window.__seleniumInstrumentationError = String(error);
                    }
                    return originalSend.apply(this, arguments);
                  };

                  try {
                    if (!Location.prototype.__seleniumOriginalAssign) {
                      Location.prototype.__seleniumOriginalAssign = Location.prototype.assign;
                      Location.prototype.assign = function(url) {
                        window.__seleniumRedirectUrl = String(url || '');
                        if (!window.__seleniumPreventRedirect) {
                          return Location.prototype.__seleniumOriginalAssign.call(this, url);
                        }
                      };
                    }
                  } catch (error) {
                    window.__seleniumAssignPatchError = String(error);
                  }
                } else {
                  window.__seleniumApiStats.updateCartCalls = 0;
                  window.__seleniumApiStats.checkoutCalls = 0;
                  window.__seleniumApiStats.lastPatchBody = '';
                  window.__seleniumApiStats.lastCheckoutBody = '';
                  window.__seleniumRedirectUrl = '';
                  window.__seleniumPreventRedirect = false;
                }
                """);
    }

    private void preventRedirect() {
        ((JavascriptExecutor) driver).executeScript("window.__seleniumPreventRedirect = true;");
    }

    private long extractCurrencyValue(String text) {
        String digits = text.replaceAll("[^0-9]", "");
        return digits.isEmpty() ? 0L : Long.parseLong(digits);
    }

    private long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }
}
