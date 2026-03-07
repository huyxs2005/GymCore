package com.gymcore.backend.modules.product.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.util.List;
import java.util.Map;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class ProductSalesServiceAdminCatalogTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private ProductSalesService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        PayOsService payOsService = Mockito.mock(PayOsService.class);
        UserNotificationService notificationService = Mockito.mock(UserNotificationService.class);
        OrderInvoiceService orderInvoiceService = Mockito.mock(OrderInvoiceService.class);
        service = new ProductSalesService(
                jdbcTemplate,
                currentUserService,
                payOsService,
                notificationService,
                orderInvoiceService);
        ReflectionTestUtils.setField(service, "productImageDir", "uploads/products-test");
        ReflectionTestUtils.setField(service, "productImageMaxBytes", 5_242_880L);
    }

    @Test
    void adminCreateProduct_shouldPersistCategoriesAndImages() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.ProductCategories"),
                eq(Integer.class),
                eq(1),
                eq(2)))
                .thenReturn(2);
        when(jdbcTemplate.update(any(org.springframework.jdbc.core.PreparedStatementCreator.class), any(org.springframework.jdbc.support.KeyHolder.class)))
                .thenAnswer(invocation -> {
                    org.springframework.jdbc.support.KeyHolder keyHolder = invocation.getArgument(1);
                    keyHolder.getKeyList().add(Map.of("ProductID", 25));
                    return 1;
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> response = service.execute("admin-create-product", "Bearer admin", Map.of(
                "name", "Whey Isolate",
                "shortDescription", "Lean recovery formula",
                "description", "Premium whey isolate.",
                "usageInstructions", "Mix 1 scoop after training.",
                "price", 2600,
                "categoryIds", List.of(1, 2),
                "images", List.of(
                        Map.of("imageUrl", "https://cdn.example/isolate-main.jpg", "altText", "Main", "displayOrder", 1, "isPrimary", true),
                        Map.of("imageUrl", "https://cdn.example/isolate-side.jpg", "altText", "Side", "displayOrder", 2, "isPrimary", false))));

        assertEquals(Boolean.TRUE, response.get("created"));
        assertEquals(25, response.get("productId"));
        verify(jdbcTemplate).update(contains("INSERT INTO dbo.ProductCategoryMap"), eq(25), eq(1));
        verify(jdbcTemplate).update(contains("INSERT INTO dbo.ProductCategoryMap"), eq(25), eq(2));
        verify(jdbcTemplate).update(
                contains("INSERT INTO dbo.ProductImages"),
                eq(25),
                eq("https://cdn.example/isolate-main.jpg"),
                eq("Main"),
                eq(1),
                eq(true));
    }

    @Test
    void adminCreateProduct_shouldRejectMultiplePrimaryImages() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-product", "Bearer admin", Map.of(
                        "name", "Creatine",
                        "price", 1100,
                        "images", List.of(
                                Map.of("imageUrl", "https://cdn.example/a.jpg", "displayOrder", 1, "isPrimary", true),
                                Map.of("imageUrl", "https://cdn.example/b.jpg", "displayOrder", 2, "isPrimary", true)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("primary image"));
    }

    @Test
    void adminCreateProduct_shouldRejectDuplicateImageUrls() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-product", "Bearer admin", Map.of(
                        "name", "Creatine",
                        "price", 1100,
                        "images", List.of(
                                Map.of("imageUrl", "https://cdn.example/a.jpg", "displayOrder", 1, "isPrimary", true),
                                Map.of("imageUrl", "https://cdn.example/a.jpg", "displayOrder", 2, "isPrimary", false)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("Duplicate product image URLs"));
    }

    @Test
    void adminCreateProduct_shouldRejectDuplicateDisplayOrders() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-product", "Bearer admin", Map.of(
                        "name", "Creatine",
                        "price", 1100,
                        "images", List.of(
                                Map.of("imageUrl", "https://cdn.example/a.jpg", "displayOrder", 1, "isPrimary", true),
                                Map.of("imageUrl", "https://cdn.example/b.jpg", "displayOrder", 1, "isPrimary", false)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("display orders"));
    }

    @Test
    void adminArchiveProduct_shouldFailWhenProductMissing() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.update(
                contains("SET IsActive = 0"),
                anyInt(),
                eq(999)))
                .thenReturn(0);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-archive-product", "Bearer admin", Map.of("productId", 999)));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Product not found.", exception.getReason());
    }

    @Test
    void adminRestoreProduct_shouldReturnRestoredWhenProductExists() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.update(
                contains("SET IsActive = 1"),
                anyInt(),
                eq(77)))
                .thenReturn(1);

        Map<String, Object> response = service.execute("admin-restore-product", "Bearer admin", Map.of("productId", 77));

        assertEquals(Boolean.TRUE, response.get("restored"));
        assertEquals(77, response.get("productId"));
    }

    @Test
    void uploadProductImage_shouldStoreValidImageAndReturnPublicUrl() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "whey.png",
                "image/png",
                new byte[] {
                        (byte) 0x89, 0x50, 0x4E, 0x47,
                        0x0D, 0x0A, 0x1A, 0x0A,
                        0x00
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> response = service.uploadProductImage("Bearer admin", file);

        assertTrue(String.valueOf(response.get("imageUrl")).startsWith("/uploads/products/catalog/"));
    }

    @Test
    void uploadProductImage_shouldRejectFileLargerThanConfiguredLimit() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "huge.png",
                "image/png",
                new byte[(5 * 1024 * 1024) + 1]);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.uploadProductImage("Bearer admin", file));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Product image file is too large.", exception.getReason());
    }

    @Test
    void uploadProductImage_shouldRejectNonImageBytes() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "bad.txt",
                "text/plain",
                "not-an-image".getBytes());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.uploadProductImage("Bearer admin", file));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Only JPG, PNG, or WEBP images are allowed.", exception.getReason());
    }

    @Test
    void deleteUploadedProductImage_shouldDeleteUnreferencedManagedFile() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.ProductImages"),
                eq(Integer.class),
                eq("/uploads/products/catalog/to-delete.png"),
                eq("/uploads/products/catalog/to-delete.png"),
                eq("/uploads/products/catalog/to-delete.png")))
                .thenReturn(0);

        Path baseDir = Path.of("uploads/products-test").toAbsolutePath().normalize();
        Files.createDirectories(baseDir.resolve("catalog"));
        Path imagePath = baseDir.resolve("catalog").resolve("to-delete.png");
        Files.write(imagePath, new byte[] { 1, 2, 3 });

        Map<String, Object> response = service.deleteUploadedProductImage("Bearer admin", "/uploads/products/catalog/to-delete.png");

        assertEquals(Boolean.TRUE, response.get("deleted"));
        assertTrue(Files.notExists(imagePath));
    }

    @Test
    void deleteUploadedProductImage_shouldKeepFileWhenStillReferenced() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.ProductImages"),
                eq(Integer.class),
                eq("/uploads/products/catalog/in-use.png"),
                eq("/uploads/products/catalog/in-use.png"),
                eq("/uploads/products/catalog/in-use.png")))
                .thenReturn(1);

        Path baseDir = Path.of("uploads/products-test").toAbsolutePath().normalize();
        Files.createDirectories(baseDir.resolve("catalog"));
        Path imagePath = baseDir.resolve("catalog").resolve("in-use.png");
        Files.write(imagePath, new byte[] { 1, 2, 3 });

        Map<String, Object> response = service.deleteUploadedProductImage("Bearer admin", "/uploads/products/catalog/in-use.png");

        assertEquals(Boolean.FALSE, response.get("deleted"));
        assertTrue(Files.exists(imagePath));
    }

    @Test
    void deleteUploadedProductImage_shouldIgnoreExternalUrls() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        Map<String, Object> response = service.deleteUploadedProductImage("Bearer admin", "https://cdn.example/whey.png");

        assertFalse((Boolean) response.get("deleted"));
    }
}
