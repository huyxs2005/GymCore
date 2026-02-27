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

import com.gymcore.backend.modules.admin.service.ReportService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class PromotionServiceTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private ReportService reportService;
    private PromotionService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        reportService = Mockito.mock(ReportService.class);
        service = new PromotionService(jdbcTemplate, currentUserService, reportService);
    }

    @Test
    void customerApplyCoupon_shouldReturnPreviewForProductCheckout() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        Map<String, Object> claim = new HashMap<>();
        claim.put("ClaimID", 99);
        claim.put("PromoCode", "WELCOME10");
        claim.put("DiscountPercent", new BigDecimal("10.00"));
        claim.put("DiscountAmount", null);
        claim.put("BonusDurationDays", 0);
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
        assertEquals(0, result.get("bonusDurationDays"));
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
        claim.put("PromoCode", "SUMMERPLUS30");
        claim.put("DiscountPercent", null);
        claim.put("DiscountAmount", null);
        claim.put("BonusDurationDays", 30);
        claim.put("ValidFrom", "2026-01-01");
        claim.put("ValidTo", "2026-12-31");

        when(jdbcTemplate.queryForList(contains("SELECT TOP (1)"), eq(5), eq("SUMMERPLUS30")))
                .thenReturn(List.of(claim));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-apply-coupon", "Bearer customer", Map.of(
                        "promoCode", "SUMMERPLUS30",
                        "target", "ORDER",
                        "subtotal", 800000)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("membership purchases only"));
    }

    @Test
    void adminCreateCoupon_shouldRejectEmptyBenefitCoupon() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-coupon", "Bearer admin", Map.of(
                        "promoCode", "EMPTY0",
                        "description", "Invalid empty coupon",
                        "discountPercent", "",
                        "discountAmount", "",
                        "bonusDurationDays", 0,
                        "validFrom", "2026-01-01",
                        "validTo", "2026-12-31",
                        "isActive", 1)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("discount or bonus duration"));
        verify(jdbcTemplate, never()).update(startsWith("INSERT INTO dbo.Promotions"), any(), any(), any(), any(),
                any(), any(), any(), any());
    }
}
