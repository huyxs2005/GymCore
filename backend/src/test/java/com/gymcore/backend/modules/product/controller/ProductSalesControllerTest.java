package com.gymcore.backend.modules.product.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.product.service.ProductSalesService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;

class ProductSalesControllerTest {

    private ProductSalesService productSalesService;
    private ProductSalesController controller;

    @BeforeEach
    void setUp() {
        productSalesService = Mockito.mock(ProductSalesService.class);
        controller = new ProductSalesController(productSalesService);
    }

    @Test
    void getInvoices_shouldDelegateToAdminInvoiceAction() {
        when(productSalesService.execute("admin-get-invoices", "Bearer admin", null))
                .thenReturn(Map.of("invoices", java.util.List.of()));

        ApiResponse<Map<String, Object>> response = controller.getInvoices("Bearer admin");

        assertEquals("Invoices retrieved", response.message());
        assertEquals(java.util.List.of(), response.data().get("invoices"));
        verify(productSalesService).execute("admin-get-invoices", "Bearer admin", null);
    }

    @Test
    void getInvoiceDetail_shouldDelegateToInvoiceDetailAction() {
        when(productSalesService.execute("admin-get-invoice-detail", "Bearer admin", Map.of("invoiceId", 22)))
                .thenReturn(Map.of("invoice", Map.of("invoiceId", 22)));

        ApiResponse<Map<String, Object>> response = controller.getInvoiceDetail("Bearer admin", 22);

        assertEquals("Invoice detail retrieved", response.message());
        assertEquals(22, ((Map<?, ?>) response.data().get("invoice")).get("invoiceId"));
        verify(productSalesService).execute("admin-get-invoice-detail", "Bearer admin", Map.of("invoiceId", 22));
    }

    @Test
    void updateReview_shouldDelegateToCustomerReviewUpdateAction() {
        Map<String, Object> payload = Map.of("rating", 4, "comment", "Cleaner taste.");
        when(productSalesService.execute("customer-update-review", "Bearer customer",
                Map.of("productId", 9, "body", payload)))
                .thenReturn(Map.of("updated", true));

        ApiResponse<Map<String, Object>> response = controller.updateReview("Bearer customer", 9, payload);

        assertEquals("Product review updated", response.message());
        assertEquals(Boolean.TRUE, response.data().get("updated"));
        verify(productSalesService).execute("customer-update-review", "Bearer customer",
                Map.of("productId", 9, "body", payload));
    }

    @Test
    void deleteReview_shouldDelegateToCustomerReviewDeleteAction() {
        when(productSalesService.execute("customer-delete-review", "Bearer customer", Map.of("productId", 9)))
                .thenReturn(Map.of("deleted", true));

        ApiResponse<Map<String, Object>> response = controller.deleteReview("Bearer customer", 9);

        assertEquals("Product review deleted", response.message());
        assertEquals(Boolean.TRUE, response.data().get("deleted"));
        verify(productSalesService).execute("customer-delete-review", "Bearer customer", Map.of("productId", 9));
    }

    @Test
    void uploadProductImage_shouldDelegateToUploadServiceMethod() {
        MockMultipartFile file = new MockMultipartFile("file", "whey.png", "image/png", new byte[] { 1, 2, 3 });
        when(productSalesService.uploadProductImage("Bearer admin", file))
                .thenReturn(Map.of("imageUrl", "/uploads/products/catalog/whey.png"));

        ApiResponse<Map<String, Object>> response = controller.uploadProductImage("Bearer admin", file);

        assertEquals("Product image uploaded", response.message());
        assertEquals("/uploads/products/catalog/whey.png", response.data().get("imageUrl"));
        verify(productSalesService).uploadProductImage("Bearer admin", file);
    }

    @Test
    void deleteUploadedProductImage_shouldDelegateToDeleteServiceMethod() {
        when(productSalesService.deleteUploadedProductImage("Bearer admin", "/uploads/products/catalog/whey.png"))
                .thenReturn(Map.of("deleted", true));

        ApiResponse<Map<String, Object>> response = controller.deleteUploadedProductImage(
                "Bearer admin", "/uploads/products/catalog/whey.png");

        assertEquals("Product image deleted", response.message());
        assertEquals(Boolean.TRUE, response.data().get("deleted"));
        verify(productSalesService).deleteUploadedProductImage("Bearer admin", "/uploads/products/catalog/whey.png");
    }

    @Test
    void confirmInvoicePickup_shouldDelegateToPickupAction() {
        when(productSalesService.execute("admin-confirm-invoice-pickup", "Bearer staff", Map.of("invoiceId", 22)))
                .thenReturn(Map.of("invoice", Map.of("invoiceId", 22)));

        ApiResponse<Map<String, Object>> response = controller.confirmInvoicePickup("Bearer staff", 22);

        assertEquals("Pickup confirmed", response.message());
        assertEquals(22, ((Map<?, ?>) response.data().get("invoice")).get("invoiceId"));
        verify(productSalesService).execute("admin-confirm-invoice-pickup", "Bearer staff", Map.of("invoiceId", 22));
    }

    @Test
    void resendInvoiceEmail_shouldDelegateToResendAction() {
        when(productSalesService.execute("admin-resend-invoice-email", "Bearer staff", Map.of("invoiceId", 22)))
                .thenReturn(Map.of("invoice", Map.of("invoiceId", 22)));

        ApiResponse<Map<String, Object>> response = controller.resendInvoiceEmail("Bearer staff", 22);

        assertEquals("Invoice email processed", response.message());
        assertEquals(22, ((Map<?, ?>) response.data().get("invoice")).get("invoiceId"));
        verify(productSalesService).execute("admin-resend-invoice-email", "Bearer staff", Map.of("invoiceId", 22));
    }

    @Test
    void productPaymentWebhook_shouldDelegateToWebhookAction() {
        HttpHeaders headers = new HttpHeaders();
        Map<String, Object> payload = Map.of("status", "SUCCESS");
        when(productSalesService.execute("payment-webhook", null, Map.of("headers", headers, "body", payload)))
                .thenReturn(Map.of("handled", true));

        ApiResponse<Map<String, Object>> response = controller.productPaymentWebhook(headers, payload);

        assertEquals("Product payment webhook handled", response.message());
        assertEquals(Boolean.TRUE, response.data().get("handled"));
        verify(productSalesService).execute("payment-webhook", null, Map.of("headers", headers, "body", payload));
    }

    @Test
    void restoreProduct_shouldDelegateToRestoreAction() {
        when(productSalesService.execute("admin-restore-product", "Bearer admin", Map.of("productId", 12)))
                .thenReturn(Map.of("restored", true, "productId", 12));

        ApiResponse<Map<String, Object>> response = controller.restoreProduct("Bearer admin", 12);

        assertEquals("Admin product restored", response.message());
        assertEquals(Boolean.TRUE, response.data().get("restored"));
        verify(productSalesService).execute("admin-restore-product", "Bearer admin", Map.of("productId", 12));
    }
}
