package com.gymcore.backend.modules.promotion.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.admin.service.ReportService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class PromotionServiceTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private ReportService reportService;
    private UserNotificationService notificationService;
    private PromotionService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        reportService = Mockito.mock(ReportService.class);
        notificationService = Mockito.mock(UserNotificationService.class);
        service = new PromotionService(jdbcTemplate, currentUserService, reportService, notificationService);
        ReflectionTestUtils.setField(service, "promotionImageDir", "uploads/promotions-test");
        ReflectionTestUtils.setField(service, "promotionImageMaxBytes", 5L * 1024 * 1024);
        lenient().when(jdbcTemplate.queryForList(contains("SELECT TOP (1) IsActive, ValidFrom, ValidTo"), eq(12)))
                .thenReturn(List.of(Map.of("IsActive", 1, "ValidFrom", "2026-03-01", "ValidTo", "2026-03-10")));
        lenient().when(jdbcTemplate.queryForList(contains("SELECT TOP (1) IsActive, ValidFrom, ValidTo"), eq(13)))
                .thenReturn(List.of(Map.of("IsActive", 1, "ValidFrom", "2026-03-01", "ValidTo", "2026-03-10")));
        lenient().when(jdbcTemplate.queryForList(contains("SELECT TOP (1) IsActive, ValidFrom, ValidTo"), eq(14)))
                .thenReturn(List.of(Map.of("IsActive", 1, "ValidFrom", "2026-03-01", "ValidTo", "2026-03-10")));
        lenient().when(jdbcTemplate.queryForList(contains("SELECT TOP (1) IsActive, ValidFrom, ValidTo"), eq(15)))
                .thenReturn(List.of(Map.of("IsActive", 1, "ValidFrom", "2026-03-01", "ValidTo", "2026-03-10")));
    }

    @Test
    void uploadPromotionBanner_shouldStoreManagedBanner() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47,
                0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x00
        };
        MockMultipartFile file = new MockMultipartFile("file", "banner.png", "image/png", png);

        Map<String, Object> response = service.uploadPromotionBanner("Bearer admin", file);

        assertTrue(String.valueOf(response.get("imageUrl")).startsWith("/uploads/promotions/banners/"));
    }

    @Test
    void uploadPromotionBanner_shouldRejectFileLargerThanConfiguredLimit() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "banner.png",
                "image/png",
                new byte[(5 * 1024 * 1024) + 1]);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.uploadPromotionBanner("Bearer admin", file));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Promotion banner file is too large. Maximum size is 5 MB.", exception.getReason());
    }

    @Test
    void deleteUploadedPromotionBanner_shouldDeleteUnreferencedManagedFile() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.contains("FROM dbo.PromotionPosts"), eq(Integer.class), eq("/uploads/promotions/banners/to-delete.png")))
                .thenReturn(0);

        Path baseDir = Path.of("uploads/promotions-test").toAbsolutePath().normalize();
        Path bannerDir = baseDir.resolve("banners");
        Files.createDirectories(bannerDir);
        Files.writeString(bannerDir.resolve("to-delete.png"), "x");

        Map<String, Object> response = service.deleteUploadedPromotionBanner("Bearer admin", "/uploads/promotions/banners/to-delete.png");

        assertEquals(Boolean.TRUE, response.get("deleted"));
        assertTrue(Files.notExists(bannerDir.resolve("to-delete.png")));
    }

    @Test
    void adminCreatePost_shouldBroadcastOnlyImportantActivePosts() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForObject(
                eq("SELECT TOP (1) PromotionPostID FROM dbo.PromotionPosts ORDER BY PromotionPostID DESC"),
                eq(Integer.class)))
                .thenReturn(77);

        service.execute("admin-create-promotion-post", "Bearer admin", Map.of(
                "title", "Standard promo",
                "content", "Low-noise update",
                "bannerUrl", "/promo.png",
                "promotionId", 12,
                "startAt", "2026-03-01",
                "endAt", "2026-03-10",
                "isActive", 1,
                "isImportant", 0));

        verify(notificationService, never()).notifyAllCustomers(any(), any(), any(), any(), any(), any());
    }

    @Test
    void adminCreatePost_shouldBroadcastImportantActivePosts() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForObject(
                eq("SELECT TOP (1) PromotionPostID FROM dbo.PromotionPosts ORDER BY PromotionPostID DESC"),
                eq(Integer.class)))
                .thenReturn(78);

        service.execute("admin-create-promotion-post", "Bearer admin", Map.of(
                "title", "Important promo",
                "content", "Broadcast-worthy update",
                "bannerUrl", "/important.png",
                "promotionId", 13,
                "startAt", "2026-03-01",
                "endAt", "2026-03-10",
                "isActive", 1,
                "isImportant", 1));

        verify(notificationService).notifyAllCustomers(
                eq("PROMOTION_POST_PUBLISHED"),
                eq("New promotion available"),
                contains("Important promo is now live."),
                eq("/customer/promotions"),
                eq(78),
                eq("PROMOTION_POST_78"));
    }

    @Test
    void adminCreatePost_shouldRejectInactiveLinkedCoupon() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForList(contains("SELECT TOP (1) IsActive, ValidFrom, ValidTo"), eq(21)))
                .thenReturn(List.of(Map.of("IsActive", 0, "ValidFrom", "2026-03-01", "ValidTo", "2026-03-10")));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-promotion-post", "Bearer admin", Map.of(
                        "title", "Inactive coupon promo",
                        "content", "Should fail",
                        "bannerUrl", "/promo.png",
                        "promotionId", 21,
                        "startAt", "2026-03-01",
                        "endAt", "2026-03-10",
                        "isActive", 1,
                        "isImportant", 0)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Linked coupon must be active before publishing a marketing post.", exception.getReason());
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.PromotionPosts"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }

    @Test
    void adminUpdatePost_shouldBroadcastWhenPostBecomesImportantAndActive() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForList(contains("SELECT TOP (1) IsActive, IsImportant"), eq(55)))
                .thenReturn(List.of(Map.of("IsActive", 1, "IsImportant", 0)));

        service.execute("admin-update-promotion-post", "Bearer admin", Map.of(
                "postId", 55,
                "body", Map.of(
                        "title", "Now important",
                        "content", "Escalated campaign",
                        "bannerUrl", "/important.png",
                        "promotionId", 14,
                        "startAt", "2026-03-01",
                        "endAt", "2026-03-10",
                        "isActive", 1,
                        "isImportant", 1)));

        verify(notificationService).notifyAllCustomers(
                eq("PROMOTION_POST_PUBLISHED"),
                eq("New promotion available"),
                contains("Now important is now live."),
                eq("/customer/promotions"),
                eq(55),
                eq("PROMOTION_POST_55"));
    }

    @Test
    void adminUpdatePost_shouldNotBroadcastWhenPostWasAlreadyImportant() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.queryForList(contains("SELECT TOP (1) IsActive, IsImportant"), eq(56)))
                .thenReturn(List.of(Map.of("IsActive", 1, "IsImportant", 1)));

        service.execute("admin-update-promotion-post", "Bearer admin", Map.of(
                "postId", 56,
                "body", Map.of(
                        "title", "Still important",
                        "content", "Already broadcast",
                        "bannerUrl", "/important.png",
                        "promotionId", 15,
                        "startAt", "2026-03-01",
                        "endAt", "2026-03-10",
                        "isActive", 1,
                        "isImportant", 1)));

        verify(notificationService, never()).notifyAllCustomers(any(), any(), any(), any(), any(), any());
    }

    @Test
    void customerApplyCoupon_shouldReturnPreviewForProductCheckout() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        Map<String, Object> claim = new HashMap<>();
        claim.put("ClaimID", 99);
        claim.put("PromoCode", "WELCOME10");
        claim.put("ApplyTarget", "ORDER");
        claim.put("DiscountPercent", new BigDecimal("10.00"));
        claim.put("DiscountAmount", null);
        claim.put("BonusDurationMonths", 0);
        claim.put("ValidFrom", "2026-01-01");
        claim.put("ValidTo", "2026-12-31");

        when(jdbcTemplate.queryForList(contains("SELECT TOP (1)"), eq(5), eq("WELCOME10")))
                .thenReturn(List.of(claim));

        Map<String, Object> result = service.execute("customer-apply-coupon", "Bearer customer", Map.of(
                "promoCode", "WELCOME10",
                "target", "ORDER",
                "subtotal", new BigDecimal("1000000")));

        assertEquals(true, result.get("valid"));
        assertEquals("WELCOME10", result.get("promoCode"));
        assertEquals("ORDER", result.get("target"));
        assertEquals("ORDER", result.get("applyTarget"));
        assertEquals(0, result.get("bonusDurationMonths"));
        assertEquals("VND", result.get("currency"));

        BigDecimal estimatedDiscount = (BigDecimal) result.get("estimatedDiscount");
        BigDecimal estimatedFinal = (BigDecimal) result.get("estimatedFinalAmount");
        assertNotNull(estimatedDiscount);
        assertNotNull(estimatedFinal);
        assertEquals(0, estimatedDiscount.compareTo(new BigDecimal("100000.00")));
        assertEquals(0, estimatedFinal.compareTo(new BigDecimal("900000.00")));
    }

    @Test
    void customerApplyCoupon_shouldRejectMembershipOnlyCouponForOrderCheckout() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        Map<String, Object> claim = new HashMap<>();
        claim.put("ClaimID", 100);
        claim.put("PromoCode", "SUMMERPLUS1M");
        claim.put("ApplyTarget", "MEMBERSHIP");
        claim.put("DiscountPercent", null);
        claim.put("DiscountAmount", null);
        claim.put("BonusDurationMonths", 1);
        claim.put("ValidFrom", "2026-01-01");
        claim.put("ValidTo", "2026-12-31");

        when(jdbcTemplate.queryForList(contains("SELECT TOP (1)"), eq(5), eq("SUMMERPLUS1M")))
                .thenReturn(List.of(claim));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-apply-coupon", "Bearer customer", Map.of(
                        "promoCode", "SUMMERPLUS1M",
                        "target", "ORDER",
                        "subtotal", 800000)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("membership purchases only"));
    }

    @Test
    void customerApplyCoupon_shouldReturnMembershipPreviewWithDiscountAndBonusMonths() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        Map<String, Object> claim = new HashMap<>();
        claim.put("ClaimID", 101);
        claim.put("PromoCode", "MEMBERBOOST");
        claim.put("ApplyTarget", "MEMBERSHIP");
        claim.put("DiscountPercent", new BigDecimal("5.00"));
        claim.put("DiscountAmount", null);
        claim.put("BonusDurationMonths", 2);
        claim.put("ValidFrom", "2026-01-01");
        claim.put("ValidTo", "2026-12-31");

        when(jdbcTemplate.queryForList(contains("SELECT TOP (1)"), eq(5), eq("MEMBERBOOST")))
                .thenReturn(List.of(claim));

        Map<String, Object> result = service.execute("customer-apply-coupon", "Bearer customer", Map.of(
                "promoCode", "MEMBERBOOST",
                "target", "MEMBERSHIP",
                "subtotal", new BigDecimal("2000000")));

        assertEquals(true, result.get("valid"));
        assertEquals("MEMBERSHIP", result.get("applyTarget"));
        assertEquals(2, result.get("bonusDurationMonths"));
        assertEquals(0, ((BigDecimal) result.get("estimatedDiscount")).compareTo(new BigDecimal("100000.00")));
        assertEquals(0, ((BigDecimal) result.get("estimatedFinalAmount")).compareTo(new BigDecimal("1900000.00")));
    }

    @Test
    void adminCreateCoupon_shouldRejectOrderCouponWithBonusMonths() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "ORDERPLUS1M",
                        "description", "Invalid order coupon with membership bonus",
                        "applyTarget", "ORDER",
                        "discountPercent", "5",
                        "discountAmount", "",
                        "bonusDurationMonths", 1,
                        "validFrom", "2026-01-01",
                        "validTo", "2026-12-31",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("cannot include bonus membership months"));
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }

    @Test
    void adminCreateCoupon_shouldRejectEmptyBenefitCoupon() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "EMPTY0",
                        "description", "Invalid empty coupon",
                        "applyTarget", "ORDER",
                        "discountPercent", "",
                        "discountAmount", "",
                        "bonusDurationMonths", 0,
                        "validFrom", "2026-01-01",
                        "validTo", "2026-12-31",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("discount or bonus duration"));
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }

    @Test
    void adminCreateCoupon_shouldRejectDiscountPercentAbove100() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "OVER100",
                        "description", "Invalid percent",
                        "applyTarget", "ORDER",
                        "discountPercent", "101",
                        "discountAmount", "",
                        "bonusDurationMonths", 0,
                        "validFrom", "2026-01-01",
                        "validTo", "2026-12-31",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Discount percent must be between 0 and 100.", exception.getReason());
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }

    @Test
    void adminCreateCoupon_shouldRejectDiscountAmountExceedingSupportedRange() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "HUGEAMOUNT",
                        "description", "Invalid amount",
                        "applyTarget", "MEMBERSHIP",
                        "discountPercent", "",
                        "discountAmount", "234242343242",
                        "bonusDurationMonths", 1,
                        "validFrom", "2026-01-01",
                        "validTo", "2026-12-31",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Discount amount exceeds the maximum supported value.", exception.getReason());
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }

    @Test
    void adminCreateCoupon_shouldRejectDiscountAmountWithTooManyDecimals() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "BADSCALE",
                        "description", "Invalid decimals",
                        "applyTarget", "ORDER",
                        "discountPercent", "",
                        "discountAmount", "100.123",
                        "bonusDurationMonths", 0,
                        "validFrom", "2026-01-01",
                        "validTo", "2026-12-31",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Discount amount must have at most 2 decimal places.", exception.getReason());
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }

    @Test
    void adminCreateCoupon_shouldRejectInvalidBonusDurationMonths() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "BADMONTHS",
                        "description", "Invalid months",
                        "applyTarget", "MEMBERSHIP",
                        "discountPercent", "",
                        "discountAmount", "",
                        "bonusDurationMonths", "012321312323424e",
                        "validFrom", "2026-01-01",
                        "validTo", "2026-12-31",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Bonus duration months must be an integer.", exception.getReason());
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }

    @Test
    void adminCreateCoupon_shouldRejectInvalidDateWindow() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "BADDATE",
                        "description", "Invalid dates",
                        "applyTarget", "ORDER",
                        "discountPercent", "10",
                        "discountAmount", "",
                        "bonusDurationMonths", 0,
                        "validFrom", "2026-12-31",
                        "validTo", "2026-01-01",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Valid to must be on or after valid from.", exception.getReason());
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
    }
}
