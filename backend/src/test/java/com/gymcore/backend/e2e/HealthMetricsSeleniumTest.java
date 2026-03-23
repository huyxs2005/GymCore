package com.gymcore.backend.e2e;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.bonigarcia.wdm.WebDriverManager;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

class HealthMetricsSeleniumTest {

    private static final String BASE_URL = "http://localhost:5173";
    private static final String CUSTOMER_EMAIL = "customer@gymcore.local";
    private static final String CUSTOMER_PASSWORD = "Customer123456!";

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeEach
    void setUp() {
        WebDriverManager.chromedriver().setup();

        ChromeOptions options = new ChromeOptions();
        options.addArguments("--start-maximized");
        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(15));
    }

    @AfterEach
    void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }

    @Test
    void shouldDisplayUnderweightWhenMetricsAreLow() {
        loginAsCustomer();
        openHealthPage();
        submitHealthMetrics("165", "49");

        assertMetricCategory("Underweight");
        assertBmiSummary("Needs gain");
    }

    @Test
    void shouldDisplayNormalWhenMetricsAreInHealthyRange() {
        loginAsCustomer();
        openHealthPage();
        submitHealthMetrics("165", "57");

        assertMetricCategory("Normal");
        assertBmiSummary("Healthy");
    }

    @Test
    void shouldDisplayOverweightWhenMetricsAreHigh() {
        loginAsCustomer();
        openHealthPage();
        submitHealthMetrics("170", "80");

        assertMetricCategory("Overweight");
        assertBmiSummary("Needs reduction");
    }

    @Test
    void shouldShowErrorWhenHeightOrWeightIsZero() {
        loginAsCustomer();
        openHealthPage();
        submitHealthMetrics("170", "0");

        assertErrorToast("Invalid height or weight.");
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

    private void openHealthPage() {
        driver.get(BASE_URL + "/customer/checkin-health");
        wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//h2[contains(normalize-space(.), 'Update Body Metrics')]")));
    }

    private void submitHealthMetrics(String heightCm, String weightKg) {
        WebElement heightInput = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector("input[placeholder='170']")));
        WebElement weightInput = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector("input[placeholder='65']")));
        WebElement saveButton = wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//button[@type='submit' and contains(normalize-space(.), 'Save metrics')]")));

        heightInput.clear();
        heightInput.sendKeys(heightCm);

        weightInput.clear();
        weightInput.sendKeys(weightKg);

        saveButton.click();

        wait.until(ExpectedConditions.or(
                ExpectedConditions.textToBePresentInElementLocated(currentCategoryLocator(), "Underweight"),
                ExpectedConditions.textToBePresentInElementLocated(currentCategoryLocator(), "Normal"),
                ExpectedConditions.textToBePresentInElementLocated(currentCategoryLocator(), "Overweight"),
                ExpectedConditions.textToBePresentInElementLocated(errorToastLocator(), "Invalid height or weight.")
        ));
    }

    private By currentCategoryLocator() {
        return By.xpath("//p[normalize-space()='Current category']/following-sibling::p[1]");
    }

    private By bmiSummaryLocator() {
        return By.xpath("//p[normalize-space()='Category']/following-sibling::p[2]");
    }

    private By errorToastLocator() {
        return By.xpath("//div[contains(@class,'bg-rose-600')]//p");
    }

    private void assertMetricCategory(String expected) {
        WebElement category = wait.until(ExpectedConditions.visibilityOfElementLocated(currentCategoryLocator()));
        assertEquals(expected, category.getText().trim());
    }

    private void assertBmiSummary(String expected) {
        WebElement summary = wait.until(ExpectedConditions.visibilityOfElementLocated(bmiSummaryLocator()));
        assertEquals(expected, summary.getText().trim());
    }

    private void assertErrorToast(String expected) {
        WebElement toast = wait.until(ExpectedConditions.visibilityOfElementLocated(errorToastLocator()));
        assertTrue(toast.getText().contains(expected));
    }
}
