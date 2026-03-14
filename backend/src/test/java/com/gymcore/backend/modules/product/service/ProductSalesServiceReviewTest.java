package com.gymcore.backend.modules.product.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class ProductSalesServiceReviewTest {

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
    }

    @Test
    void customerUpdateReview_shouldUpdateExistingReview() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.Orders o"),
                eq(Integer.class),
                eq(5),
                eq(9)))
                .thenReturn(1);
        when(jdbcTemplate.update(
                contains("UPDATE dbo.ProductReviews"),
                eq(4),
                eq("Better after second tub."),
                eq(9),
                eq(5)))
                .thenReturn(1);

        Map<String, Object> response = service.execute("customer-update-review", "Bearer customer", Map.of(
                "productId", 9,
                "body", Map.of("rating", 4, "comment", "Better after second tub.")));

        assertEquals(Boolean.TRUE, response.get("updated"));
    }

    @Test
    void customerUpdateReview_shouldRejectWhenCustomerHasNotPickedUpProduct() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.Orders o"),
                eq(Integer.class),
                eq(5),
                eq(9)))
                .thenReturn(0);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-update-review", "Bearer customer", Map.of(
                        "productId", 9,
                        "body", Map.of("rating", 4, "comment", "No purchase."))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("picked up this product"));
    }

    @Test
    void customerUpdateReview_shouldReturnNotFoundWhenReviewMissing() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.Orders o"),
                eq(Integer.class),
                eq(5),
                eq(9)))
                .thenReturn(1);
        when(jdbcTemplate.update(
                contains("UPDATE dbo.ProductReviews"),
                eq(5),
                eq("Missing row."),
                eq(9),
                eq(5)))
                .thenReturn(0);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-update-review", "Bearer customer", Map.of(
                        "productId", 9,
                        "body", Map.of("rating", 5, "comment", "Missing row."))));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Review not found.", exception.getReason());
    }

    @Test
    void customerCreateReview_shouldRejectBlankComment() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-create-review", "Bearer customer", Map.of(
                        "productId", 9,
                        "body", Map.of("rating", 4, "comment", "   "))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Review comment is required.", exception.getReason());
    }

    @Test
    void customerUpdateReview_shouldRejectBlankComment() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-update-review", "Bearer customer", Map.of(
                        "productId", 9,
                        "body", Map.of("rating", 4, "comment", "   "))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Review comment is required.", exception.getReason());
    }

    @Test
    void customerCreateReview_shouldSurfaceAlreadyReviewedConstraintClearly() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.Orders o"),
                eq(Integer.class),
                eq(5),
                eq(9)))
                .thenReturn(1);
        when(jdbcTemplate.update(
                contains("INSERT INTO dbo.ProductReviews"),
                eq(9),
                eq(5),
                eq(5),
                eq("Already reviewed")))
                .thenThrow(new DuplicateKeyException("duplicate"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-create-review", "Bearer customer", Map.of(
                        "productId", 9,
                        "body", Map.of("rating", 5, "comment", "Already reviewed"))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("already reviewed"));
    }

    @Test
    void customerDeleteReview_shouldDeleteExistingReview() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(jdbcTemplate.update(
                contains("DELETE FROM dbo.ProductReviews"),
                eq(9),
                eq(5)))
                .thenReturn(1);

        Map<String, Object> response = service.execute("customer-delete-review", "Bearer customer", Map.of("productId", 9));

        assertEquals(Boolean.TRUE, response.get("deleted"));
    }

    @Test
    void customerDeleteReview_shouldReturnNotFoundWhenMissing() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(jdbcTemplate.update(
                contains("DELETE FROM dbo.ProductReviews"),
                eq(9),
                eq(5)))
                .thenReturn(0);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-delete-review", "Bearer customer", Map.of("productId", 9)));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Review not found.", exception.getReason());
    }

    @SuppressWarnings("unchecked")
    @Test
    void customerGetProductDetail_shouldIncludeCustomerReviewContext() {
        when(currentUserService.findUser("Bearer customer"))
                .thenReturn(Optional.of(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER")));
        when(jdbcTemplate.query(
                contains("WHERE p.ProductID = ? AND p.IsActive = 1"),
                any(RowMapper.class),
                eq(7)))
                .thenReturn(List.of(new LinkedHashMap<>(Map.of(
                        "productId", 7,
                        "name", "Whey Protein",
                        "description", "Protein powder",
                        "price", 2000,
                        "averageRating", 4.5,
                        "reviewCount", 2,
                        "thumbnailUrl", "https://cdn.example/whey.jpg",
                        "imageUrl", "https://cdn.example/whey.jpg",
                        "usageInstructions", "Mix after training."))));
        when(jdbcTemplate.query(
                contains("FROM dbo.ProductCategoryMap pcm"),
                any(RowMapper.class),
                eq(7)))
                .thenReturn(List.of(Map.of("productCategoryId", 1, "name", "Protein")));
        when(jdbcTemplate.query(
                contains("FROM dbo.ProductImages pi"),
                any(RowMapper.class),
                eq(7)))
                .thenReturn(List.of(Map.of(
                        "productImageId", 3,
                        "imageUrl", "https://cdn.example/whey-side.jpg",
                        "altText", "Side",
                        "displayOrder", 2,
                        "isPrimary", false)));
        when(jdbcTemplate.query(
                contains("FROM dbo.ProductReviews r"),
                any(RowMapper.class),
                eq(7)))
                .thenReturn(List.of(Map.of(
                        "productReviewId", 71,
                        "rating", 5,
                        "comment", "Great product.",
                        "reviewDate", Timestamp.valueOf("2026-03-07 08:30:00"),
                        "customerName", "Customer Minh",
                        "avatarUrl", "https://cdn.example/customer-avatar.jpg")));
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.Orders o"),
                eq(Integer.class),
                eq(5),
                eq(7)))
                .thenReturn(1);
        when(jdbcTemplate.query(
                contains("WHERE ProductID = ? AND CustomerID = ?"),
                any(RowMapper.class),
                eq(7),
                eq(5)))
                .thenReturn(List.of(Map.of(
                        "reviewId", 99,
                        "rating", 4,
                        "comment", "Already reviewed.",
                        "reviewDate", Timestamp.valueOf("2026-03-07 09:00:00"))));

        Map<String, Object> response = service.execute("customer-get-product-detail", "Bearer customer", Map.of("productId", 7));

        Map<String, Object> product = (Map<String, Object>) response.get("product");
        assertEquals(Boolean.TRUE, product.get("canReview"));
        Map<String, Object> myReview = (Map<String, Object>) product.get("myReview");
        assertEquals(99, myReview.get("reviewId"));
        assertEquals("Already reviewed.", myReview.get("comment"));
        List<Map<String, Object>> reviews = (List<Map<String, Object>>) response.get("reviews");
        assertEquals(1, reviews.size());
        assertEquals("https://cdn.example/customer-avatar.jpg", reviews.get(0).get("avatarUrl"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void customerGetProductDetail_shouldNotAttachReviewContextForGuest() {
        when(currentUserService.findUser(null)).thenReturn(Optional.empty());
        when(jdbcTemplate.query(
                contains("WHERE p.ProductID = ? AND p.IsActive = 1"),
                any(RowMapper.class),
                eq(4)))
                .thenReturn(List.of(new LinkedHashMap<>(Map.of(
                        "productId", 4,
                        "name", "Creatine",
                        "description", "Creatine powder",
                        "price", 1000,
                        "averageRating", 4.0,
                        "reviewCount", 1,
                        "thumbnailUrl", "https://cdn.example/creatine.jpg",
                        "imageUrl", "https://cdn.example/creatine.jpg",
                        "usageInstructions", "Take daily."))));
        when(jdbcTemplate.query(
                contains("FROM dbo.ProductCategoryMap pcm"),
                any(RowMapper.class),
                eq(4)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(
                contains("FROM dbo.ProductImages pi"),
                any(RowMapper.class),
                eq(4)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(
                contains("FROM dbo.ProductReviews r"),
                any(RowMapper.class),
                eq(4)))
                .thenReturn(List.of());

        Map<String, Object> response = service.execute("customer-get-product-detail", null, Map.of("productId", 4));

        Map<String, Object> product = (Map<String, Object>) response.get("product");
        assertNull(product.get("canReview"));
        assertNull(product.get("myReview"));
        assertInstanceOf(List.class, response.get("reviews"));
        verify(currentUserService).findUser(null);
    }
}
