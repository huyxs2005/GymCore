package com.gymcore.backend.modules.membership.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import com.gymcore.backend.modules.checkin.service.CheckinHealthService;
import com.gymcore.backend.modules.product.service.PayOsService;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;

class MembershipServiceCustomerFlowTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private PayOsService payOsService;
    private AuthService authService;
    private MembershipService membershipService;
    private CheckinHealthService checkinHealthService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        payOsService = Mockito.mock(PayOsService.class);
        authService = Mockito.mock(AuthService.class);
        membershipService = new MembershipService(jdbcTemplate, currentUserService, payOsService);
        checkinHealthService = new CheckinHealthService(jdbcTemplate, authService);
    }

    @Test
    void customerPurchase_shouldCreatePendingMembershipCheckout() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        // No pending checkout exists
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        // Plan exists and active
        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 2,
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY",
                            "Price", new BigDecimal("500000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", false
                    )), 0));
                });

        // Customer has no ACTIVE/SCHEDULED memberships
        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), anyString()))
                .thenReturn(List.of());

        // Checkout contact
        when(jdbcTemplate.queryForObject(contains("SELECT FullName, Phone, Email"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "FullName", "Customer Minh",
                            "Phone", "0900000004",
                            "Email", "customer@gymcore.local"
                    )), 0);
                });

        // Insert membership + payment IDs
        AtomicInteger insertSequence = new AtomicInteger(0);
        when(jdbcTemplate.update(any(PreparedStatementCreator.class), any(KeyHolder.class)))
                .thenAnswer(invocation -> {
                    KeyHolder keyHolder = invocation.getArgument(1);
                    int call = insertSequence.incrementAndGet();
                    Map<String, Object> keyMap = new LinkedHashMap<>();
                    if (call == 1) {
                        keyMap.put("CustomerMembershipID", 201);
                    } else {
                        keyMap.put("PaymentID", 301);
                    }
                    keyHolder.getKeyList().add(keyMap);
                    return 1;
                });

        when(payOsService.createPaymentLink(
                eq(301),
                eq(new BigDecimal("500000")),
                contains("Membership"),
                eq("Customer Minh"),
                eq("0900000004"),
                eq("customer@gymcore.local"),
                eq("GymCore Membership"),
                any(),
                eq(null),
                eq(null)))
                .thenReturn(new PayOsService.PayOsLink("LINK-301", "https://payos.vn/checkout/301", "PENDING"));

        when(jdbcTemplate.update(
                contains("SET PayOS_PaymentLinkId = ?"),
                eq("LINK-301"),
                eq("https://payos.vn/checkout/301"),
                eq("PENDING"),
                eq(301)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-purchase-membership",
                "Bearer customer",
                Map.of("planId", 2, "paymentMethod", "PAYOS"));

        assertEquals(301, response.get("paymentId"));
        assertEquals("https://payos.vn/checkout/301", response.get("checkoutUrl"));
        assertEquals("PAYOS", response.get("paymentMethod"));
        assertEquals("PURCHASE", response.get("mode"));

        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        assertEquals(201, membership.get("customerMembershipId"));
        assertEquals("PENDING", membership.get("status"));
        assertEquals(LocalDate.now().toString(), membership.get("startDate"));
        assertEquals(LocalDate.now().plusDays(29).toString(), membership.get("endDate"));
    }

    @Test
    void customerRenew_shouldStartFromCurrentActiveEndDatePlusOne() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 2,
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY",
                            "Price", new BigDecimal("500000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", false
                    )), 0));
                });

        LocalDate activeEnd = LocalDate.now().plusDays(4);
        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), eq("ACTIVE")))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "CustomerMembershipID", 111,
                            "Status", "ACTIVE",
                            "StartDate", LocalDate.now().minusDays(10),
                            "EndDate", activeEnd
                    )), 0));
                });
        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), eq("SCHEDULED")))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("SELECT FullName, Phone, Email"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "FullName", "Customer Minh",
                            "Phone", "0900000004",
                            "Email", "customer@gymcore.local"
                    )), 0);
                });

        AtomicInteger insertSequence = new AtomicInteger(0);
        when(jdbcTemplate.update(any(PreparedStatementCreator.class), any(KeyHolder.class)))
                .thenAnswer(invocation -> {
                    KeyHolder keyHolder = invocation.getArgument(1);
                    int call = insertSequence.incrementAndGet();
                    Map<String, Object> keyMap = new LinkedHashMap<>();
                    if (call == 1) {
                        keyMap.put("CustomerMembershipID", 401);
                    } else {
                        keyMap.put("PaymentID", 501);
                    }
                    keyHolder.getKeyList().add(keyMap);
                    return 1;
                });

        when(payOsService.createPaymentLink(
                eq(501),
                eq(new BigDecimal("500000")),
                contains("Renew"),
                eq("Customer Minh"),
                eq("0900000004"),
                eq("customer@gymcore.local"),
                eq("GymCore Membership"),
                any(),
                eq(null),
                eq(null)))
                .thenReturn(new PayOsService.PayOsLink("LINK-501", "https://payos.vn/checkout/501", "PENDING"));

        when(jdbcTemplate.update(
                contains("SET PayOS_PaymentLinkId = ?"),
                eq("LINK-501"),
                eq("https://payos.vn/checkout/501"),
                eq("PENDING"),
                eq(501)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-renew-membership",
                "Bearer customer",
                Map.of("planId", 2, "paymentMethod", "PAYOS"));

        assertEquals("RENEW", response.get("mode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        LocalDate expectedStart = activeEnd.plusDays(1);
        assertEquals(expectedStart.toString(), membership.get("startDate"));
        assertEquals(expectedStart.plusDays(29).toString(), membership.get("endDate"));
    }

    @Test
    void customerUpgrade_shouldStartImmediatelyAndCreateScheduledPendingMembership() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(3)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 3,
                            "PlanName", "Gym + Coach - 1 Month",
                            "PlanType", "GYM_PLUS_COACH",
                            "Price", new BigDecimal("1200000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", true
                    )), 0));
                });

        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), eq("ACTIVE")))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "CustomerMembershipID", 121,
                            "Status", "ACTIVE",
                            "StartDate", LocalDate.now().minusDays(3),
                            "EndDate", LocalDate.now().plusDays(20)
                    )), 0));
                });
        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), eq("SCHEDULED")))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("SELECT FullName, Phone, Email"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "FullName", "Customer Minh",
                            "Phone", "0900000004",
                            "Email", "customer@gymcore.local"
                    )), 0);
                });

        AtomicInteger insertSequence = new AtomicInteger(0);
        when(jdbcTemplate.update(any(PreparedStatementCreator.class), any(KeyHolder.class)))
                .thenAnswer(invocation -> {
                    KeyHolder keyHolder = invocation.getArgument(1);
                    int call = insertSequence.incrementAndGet();
                    Map<String, Object> keyMap = new LinkedHashMap<>();
                    if (call == 1) {
                        keyMap.put("CustomerMembershipID", 402);
                    } else {
                        keyMap.put("PaymentID", 502);
                    }
                    keyHolder.getKeyList().add(keyMap);
                    return 1;
                });

        when(payOsService.createPaymentLink(
                eq(502),
                eq(new BigDecimal("1200000")),
                contains("Upgrade"),
                eq("Customer Minh"),
                eq("0900000004"),
                eq("customer@gymcore.local"),
                eq("GymCore Membership"),
                any(),
                eq(null),
                eq(null)))
                .thenReturn(new PayOsService.PayOsLink("LINK-502", "https://payos.vn/checkout/502", "PENDING"));

        when(jdbcTemplate.update(
                contains("SET PayOS_PaymentLinkId = ?"),
                eq("LINK-502"),
                eq("https://payos.vn/checkout/502"),
                eq("PENDING"),
                eq(502)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-upgrade-membership",
                "Bearer customer",
                Map.of("planId", 3, "paymentMethod", "PAYOS"));

        assertEquals("UPGRADE", response.get("mode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        assertEquals(LocalDate.now().toString(), membership.get("startDate"));
        assertEquals(LocalDate.now().plusDays(29).toString(), membership.get("endDate"));
    }

    @Test
    void customerPurchase_shouldApplyMembershipCouponDiscountAndBonusMonth() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 2,
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY",
                            "Price", new BigDecimal("500000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", false
                    )), 0));
                });

        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), anyString()))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("SELECT FullName, Phone, Email"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "FullName", "Customer Minh",
                            "Phone", "0900000004",
                            "Email", "customer@gymcore.local"
                    )), 0);
                });

        Map<String, Object> membershipClaim = new LinkedHashMap<>();
        membershipClaim.put("ClaimID", 77);
        membershipClaim.put("ApplyTarget", "MEMBERSHIP");
        membershipClaim.put("DiscountPercent", new BigDecimal("10.00"));
        membershipClaim.put("DiscountAmount", null);
        membershipClaim.put("BonusDurationMonths", 1);
        when(jdbcTemplate.queryForList(contains("FROM dbo.UserPromotionClaims"), eq(5), eq("MEMBERBOOST")))
                .thenReturn(List.of(membershipClaim));

        AtomicInteger insertSequence = new AtomicInteger(0);
        when(jdbcTemplate.update(any(PreparedStatementCreator.class), any(KeyHolder.class)))
                .thenAnswer(invocation -> {
                    KeyHolder keyHolder = invocation.getArgument(1);
                    int call = insertSequence.incrementAndGet();
                    Map<String, Object> keyMap = new LinkedHashMap<>();
                    if (call == 1) {
                        keyMap.put("CustomerMembershipID", 211);
                    } else {
                        keyMap.put("PaymentID", 311);
                    }
                    keyHolder.getKeyList().add(keyMap);
                    return 1;
                });

        when(payOsService.createPaymentLink(
                eq(311),
                eq(new BigDecimal("450000.00")),
                contains("Membership"),
                eq("Customer Minh"),
                eq("0900000004"),
                eq("customer@gymcore.local"),
                eq("GymCore Membership"),
                any(),
                eq(null),
                eq(null)))
                .thenReturn(new PayOsService.PayOsLink("LINK-311", "https://payos.vn/checkout/311", "PENDING"));

        when(jdbcTemplate.update(
                contains("SET PayOS_PaymentLinkId = ?"),
                eq("LINK-311"),
                eq("https://payos.vn/checkout/311"),
                eq("PENDING"),
                eq(311)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-purchase-membership",
                "Bearer customer",
                Map.of("planId", 2, "paymentMethod", "PAYOS", "promoCode", "MEMBERBOOST"));

        assertEquals(new BigDecimal("500000"), response.get("subtotal"));
        assertEquals(new BigDecimal("50000.00"), response.get("discount"));
        assertEquals(new BigDecimal("450000.00"), response.get("totalAmount"));

        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        assertEquals(LocalDate.now().toString(), membership.get("startDate"));
        assertEquals(LocalDate.now().plusDays(29).plusMonths(1).toString(), membership.get("endDate"));
    }

    @Test
    void customerGetCurrentMembership_shouldExposeAppliedCouponDetails() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        when(jdbcTemplate.query(contains("p.CreatedAt < DATEADD"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(contains("OUTER APPLY"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("CustomerMembershipID", 211);
                    row.put("Status", "ACTIVE");
                    row.put("StartDate", LocalDate.now().minusDays(5));
                    row.put("EndDate", LocalDate.now().plusDays(24).plusMonths(1));
                    row.put("MembershipCreatedAt", Timestamp.from(Instant.now()));
                    row.put("MembershipPlanID", 2);
                    row.put("PlanName", "Gym Only - 1 Month");
                    row.put("PlanType", "GYM_ONLY");
                    row.put("Price", new BigDecimal("500000"));
                    row.put("DurationDays", 30);
                    row.put("AllowsCoachBooking", false);
                    row.put("PaymentID", 311);
                    row.put("PaymentStatus", "PAID");
                    row.put("PaymentMethod", "PAYOS");
                    row.put("PayOS_Status", "PAID");
                    row.put("PayOS_CheckoutUrl", "https://payos.vn/checkout/311");
                    row.put("OriginalAmount", new BigDecimal("500000"));
                    row.put("DiscountAmount", new BigDecimal("50000"));
                    row.put("PaymentAmount", new BigDecimal("450000"));
                    row.put("ClaimID", 77);
                    row.put("PromoCode", "MEMBERBOOST");
                    row.put("ApplyTarget", "MEMBERSHIP");
                    row.put("BonusDurationMonths", 1);
                    row.put("PaymentCreatedAt", Timestamp.from(Instant.now()));
                    return List.of(mapper.mapRow(resultSet(row), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-get-current-membership",
                "Bearer customer",
                Map.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        @SuppressWarnings("unchecked")
        Map<String, Object> payment = (Map<String, Object>) membership.get("payment");
        @SuppressWarnings("unchecked")
        Map<String, Object> coupon = (Map<String, Object>) payment.get("coupon");

        assertEquals(new BigDecimal("500000"), payment.get("originalAmount"));
        assertEquals(new BigDecimal("50000"), payment.get("discountAmount"));
        assertEquals("MEMBERBOOST", coupon.get("promoCode"));
        assertEquals("MEMBERSHIP", coupon.get("applyTarget"));
        assertEquals(1, coupon.get("bonusDurationMonths"));
    }

    @Test
    void customerPurchase_shouldRejectOrderCouponForMembershipCheckout() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 2,
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY",
                            "Price", new BigDecimal("500000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", false
                    )), 0));
                });

        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), anyString()))
                .thenReturn(List.of());

        Map<String, Object> orderClaim = new LinkedHashMap<>();
        orderClaim.put("ClaimID", 88);
        orderClaim.put("ApplyTarget", "ORDER");
        orderClaim.put("DiscountPercent", new BigDecimal("10.00"));
        orderClaim.put("DiscountAmount", null);
        orderClaim.put("BonusDurationMonths", 0);
        when(jdbcTemplate.queryForList(contains("FROM dbo.UserPromotionClaims"), eq(5), eq("WELCOME10")))
                .thenReturn(List.of(orderClaim));

        var exception = org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> membershipService.execute(
                        "customer-purchase-membership",
                        "Bearer customer",
                        Map.of("planId", 2, "paymentMethod", "PAYOS", "promoCode", "WELCOME10")));

        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("product orders only"));
    }

    @Test
    void customerPurchase_shouldApplyBonusOnlyMembershipCouponWithoutChangingTotal() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 2,
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY",
                            "Price", new BigDecimal("500000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", false
                    )), 0));
                });

        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), anyString()))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("SELECT FullName, Phone, Email"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "FullName", "Customer Minh",
                            "Phone", "0900000004",
                            "Email", "customer@gymcore.local"
                    )), 0);
                });

        Map<String, Object> membershipClaim = new LinkedHashMap<>();
        membershipClaim.put("ClaimID", 78);
        membershipClaim.put("ApplyTarget", "MEMBERSHIP");
        membershipClaim.put("DiscountPercent", null);
        membershipClaim.put("DiscountAmount", null);
        membershipClaim.put("BonusDurationMonths", 2);
        when(jdbcTemplate.queryForList(contains("FROM dbo.UserPromotionClaims"), eq(5), eq("PLUS2M")))
                .thenReturn(List.of(membershipClaim));

        AtomicInteger insertSequence = new AtomicInteger(0);
        when(jdbcTemplate.update(any(PreparedStatementCreator.class), any(KeyHolder.class)))
                .thenAnswer(invocation -> {
                    KeyHolder keyHolder = invocation.getArgument(1);
                    int call = insertSequence.incrementAndGet();
                    Map<String, Object> keyMap = new LinkedHashMap<>();
                    if (call == 1) {
                        keyMap.put("CustomerMembershipID", 212);
                    } else {
                        keyMap.put("PaymentID", 312);
                    }
                    keyHolder.getKeyList().add(keyMap);
                    return 1;
                });

        when(payOsService.createPaymentLink(
                eq(312),
                eq(new BigDecimal("500000")),
                contains("Membership"),
                eq("Customer Minh"),
                eq("0900000004"),
                eq("customer@gymcore.local"),
                eq("GymCore Membership"),
                any(),
                eq(null),
                eq(null)))
                .thenReturn(new PayOsService.PayOsLink("LINK-312", "https://payos.vn/checkout/312", "PENDING"));

        when(jdbcTemplate.update(
                contains("SET PayOS_PaymentLinkId = ?"),
                eq("LINK-312"),
                eq("https://payos.vn/checkout/312"),
                eq("PENDING"),
                eq(312)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-purchase-membership",
                "Bearer customer",
                Map.of("planId", 2, "paymentMethod", "PAYOS", "promoCode", "PLUS2M"));

        assertEquals(new BigDecimal("500000"), response.get("subtotal"));
        assertEquals(BigDecimal.ZERO.setScale(2), ((BigDecimal) response.get("discount")).setScale(2));
        assertEquals(new BigDecimal("500000"), response.get("totalAmount"));

        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        assertEquals(LocalDate.now().plusDays(29).plusMonths(2).toString(), membership.get("endDate"));
    }

    @Test
    void paymentSuccessAfterPurchase_shouldAllowReceptionQrCheckin() throws Exception {
        AtomicBoolean membershipActivated = new AtomicBoolean(false);

        // Webhook verification passes
        Mockito.doNothing().when(payOsService).verifyWebhookSignature(any(HttpHeaders.class), any(Map.class));
        when(payOsService.resolvePaymentIdFromPayOsOrderCode(eq(999))).thenReturn(999);

        when(jdbcTemplate.update(contains("SET PayOS_Status = ?"), eq("PAID"), eq(999))).thenReturn(1);
        when(jdbcTemplate.update(eq("EXEC dbo.sp_ConfirmPaymentSuccess ?"), eq(999)))
                .thenAnswer(invocation -> {
                    membershipActivated.set(true);
                    return 1;
                });
        when(jdbcTemplate.queryForObject(contains("cm.Status = 'SCHEDULED'"), any(RowMapper.class), eq(999)))
                .thenThrow(new EmptyResultDataAccessException(1));

        Map<String, Object> webhookPayload = new LinkedHashMap<>();
        webhookPayload.put("headers", new HttpHeaders());
        webhookPayload.put("body", Map.of(
                "paymentId", 999,
                "status", "PAID"));

        @SuppressWarnings("unchecked")
        Map<String, Object> webhookResult = membershipService.execute("payment-webhook", null, webhookPayload);
        assertTrue(Boolean.TRUE.equals(webhookResult.get("handled")));

        // Receptionist scan check-in
        when(authService.requireAuthContext("Bearer receptionist"))
                .thenReturn(new AuthService.AuthContext(2, "RECEPTIONIST", "Receptionist GymCore", "reception@gymcore.local"));

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID = ?"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "UserID", 5,
                            "FullName", "Customer Minh",
                            "Email", "customer@gymcore.local",
                            "Phone", "0900000004"
                    )), 0);
                });

        when(jdbcTemplate.query(contains("cm.Status = 'ACTIVE'"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    if (!membershipActivated.get()) {
                        return List.of();
                    }
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "CustomerMembershipID", 321,
                            "Status", "ACTIVE",
                            "StartDate", LocalDate.now(),
                            "EndDate", LocalDate.now().plusDays(29),
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY"
                    )), 0));
                });

        when(jdbcTemplate.update(contains("INSERT INTO dbo.CheckIns"), eq(5), eq(321), eq(2))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("FROM dbo.CheckIns ci"), any(RowMapper.class), eq(5), eq(321), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "CheckInID", 1001,
                            "CheckInTime", Timestamp.from(Instant.parse("2026-02-25T10:00:00Z"))
                    )), 0);
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> checkinResult = checkinHealthService.execute("reception-scan-checkin", Map.of(
                "authorizationHeader", "Bearer receptionist",
                "customerId", 5
        ));

        assertEquals(1001, checkinResult.get("checkInId"));
        assertEquals("2026-02-25T10:00:00Z", checkinResult.get("checkInTime"));
    }

    @Test
    void paymentWebhook_shouldApplyImmediateUpgradeSwitchWhenScheduledStartsToday() throws Exception {
        Mockito.doNothing().when(payOsService).verifyWebhookSignature(any(HttpHeaders.class), any(Map.class));
        when(payOsService.resolvePaymentIdFromPayOsOrderCode(eq(888))).thenReturn(888);

        when(jdbcTemplate.update(contains("SET PayOS_Status = ?"), eq("PAID"), eq(888))).thenReturn(1);
        when(jdbcTemplate.update(eq("EXEC dbo.sp_ConfirmPaymentSuccess ?"), eq(888))).thenReturn(1);

        when(jdbcTemplate.queryForObject(contains("cm.Status = 'SCHEDULED'"), any(RowMapper.class), eq(888)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "CustomerMembershipID", 9001,
                            "CustomerID", 5
                    )), 0);
                });

        when(jdbcTemplate.queryForObject(contains("SELECT COUNT(1)"), eq(Integer.class), eq(5), eq(9001)))
                .thenReturn(1);

        when(jdbcTemplate.update(contains("SET Status = 'EXPIRED'"), eq(5), eq(9001))).thenReturn(1);
        when(jdbcTemplate.update(contains("SET Status = 'ACTIVE'"), eq(9001))).thenReturn(1);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("headers", new HttpHeaders());
        payload.put("body", Map.of("paymentId", 888, "status", "PAID"));

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute("payment-webhook", null, payload);

        assertTrue(Boolean.TRUE.equals(response.get("handled")));
        verify(jdbcTemplate).update(contains("SET Status = 'EXPIRED'"), eq(5), eq(9001));
        verify(jdbcTemplate).update(contains("SET Status = 'ACTIVE'"), eq(9001));
    }

    @Test
    void confirmPaymentReturn_shouldConfirmMembershipPaymentForOwner() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(payOsService.resolvePaymentIdFromPayOsOrderCode(eq(777))).thenReturn(777);

        when(jdbcTemplate.queryForObject(
                contains("JOIN dbo.CustomerMemberships cm"),
                eq(Integer.class),
                eq(777),
                eq(5)))
                .thenReturn(1);

        when(jdbcTemplate.update(eq("EXEC dbo.sp_ConfirmPaymentSuccess ?"), eq(777))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("cm.Status = 'SCHEDULED'"), any(RowMapper.class), eq(777)))
                .thenThrow(new EmptyResultDataAccessException(1));

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-confirm-payment-return",
                "Bearer customer",
                Map.of("paymentId", 777, "status", "SUCCESS"));

        assertTrue(Boolean.TRUE.equals(response.get("handled")));
        assertEquals(777, response.get("paymentId"));
        assertEquals("SUCCESS", response.get("status"));
    }

    @Test
    void confirmPaymentReturn_shouldDecodeEncodedPayOsOrderCode() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(payOsService.resolvePaymentIdFromPayOsOrderCode(eq("777654321"))).thenReturn(777);

        when(jdbcTemplate.queryForObject(
                contains("JOIN dbo.CustomerMemberships cm"),
                eq(Integer.class),
                eq(777),
                eq(5)))
                .thenReturn(1);

        when(jdbcTemplate.update(eq("EXEC dbo.sp_ConfirmPaymentSuccess ?"), eq(777))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("cm.Status = 'SCHEDULED'"), any(RowMapper.class), eq(777)))
                .thenThrow(new EmptyResultDataAccessException(1));

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-confirm-payment-return",
                "Bearer customer",
                Map.of("orderCode", "777654321", "status", "SUCCESS"));

        assertTrue(Boolean.TRUE.equals(response.get("handled")));
        assertEquals(777, response.get("paymentId"));
    }

    @Test
    void customerPurchase_shouldReusePendingCheckoutWithinFiveMinutesWhenSamePlan() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        // Stale-expiry query
        when(jdbcTemplate.query(contains("p.CreatedAt < DATEADD"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        // Existing pending checkout query
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.ofEntries(
                            Map.entry("PaymentID", 301),
                            Map.entry("PayOS_CheckoutUrl", "https://payos.vn/checkout/301"),
                            Map.entry("PaymentMethod", "PAYOS"),
                            Map.entry("OriginalAmount", new BigDecimal("500000")),
                            Map.entry("DiscountAmount", BigDecimal.ZERO),
                            Map.entry("Amount", new BigDecimal("500000")),
                            Map.entry("PaymentCreatedAt", Timestamp.from(Instant.now())),
                            Map.entry("CustomerMembershipID", 201),
                            Map.entry("StartDate", LocalDate.now()),
                            Map.entry("EndDate", LocalDate.now().plusDays(29)),
                            Map.entry("MembershipPlanID", 2),
                            Map.entry("PlanName", "Gym Only - 1 Month"),
                            Map.entry("PlanType", "GYM_ONLY"),
                            Map.entry("Price", new BigDecimal("500000")),
                            Map.entry("DurationDays", 30),
                            Map.entry("AllowsCoachBooking", false)
                    )), 0));
                });

        // Requested plan + no active/scheduled membership
        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 2,
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY",
                            "Price", new BigDecimal("500000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", false
                    )), 0));
                });
        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), anyString()))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-purchase-membership",
                "Bearer customer",
                Map.of("planId", 2, "paymentMethod", "PAYOS"));

        assertEquals(301, response.get("paymentId"));
        assertEquals("https://payos.vn/checkout/301", response.get("checkoutUrl"));
        assertTrue(Boolean.TRUE.equals(response.get("reusedCheckout")));
        verify(payOsService, never()).createPaymentLink(anyInt(), any(BigDecimal.class), anyString(),
                anyString(), anyString(), anyString(), anyString(), any(), any(), any());
    }

    @Test
    void customerPurchase_shouldCancelDifferentPendingCheckoutAndCreateNewOne() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        // Stale-expiry query
        when(jdbcTemplate.query(contains("p.CreatedAt < DATEADD"), any(RowMapper.class), eq(5), eq(5)))
                .thenReturn(List.of());

        // Existing pending checkout is for another plan (planId 2)
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.ofEntries(
                            Map.entry("PaymentID", 301),
                            Map.entry("PayOS_CheckoutUrl", "https://payos.vn/checkout/301"),
                            Map.entry("PaymentMethod", "PAYOS"),
                            Map.entry("OriginalAmount", new BigDecimal("500000")),
                            Map.entry("DiscountAmount", BigDecimal.ZERO),
                            Map.entry("Amount", new BigDecimal("500000")),
                            Map.entry("PaymentCreatedAt", Timestamp.from(Instant.now())),
                            Map.entry("CustomerMembershipID", 201),
                            Map.entry("StartDate", LocalDate.now()),
                            Map.entry("EndDate", LocalDate.now().plusDays(29)),
                            Map.entry("MembershipPlanID", 2),
                            Map.entry("PlanName", "Gym Only - 1 Month"),
                            Map.entry("PlanType", "GYM_ONLY"),
                            Map.entry("Price", new BigDecimal("500000")),
                            Map.entry("DurationDays", 30),
                            Map.entry("AllowsCoachBooking", false)
                    )), 0));
                });

        // Requested plan is different (planId 3)
        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(3)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 3,
                            "PlanName", "Gym + Coach - 1 Month",
                            "PlanType", "GYM_PLUS_COACH",
                            "Price", new BigDecimal("1200000"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", true
                    )), 0));
                });
        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), anyString()))
                .thenReturn(List.of());

        when(jdbcTemplate.update(contains("SET Status = 'CANCELLED'"), eq("CANCELLED"), eq(301))).thenReturn(1);
        when(jdbcTemplate.update(contains("WHERE CustomerMembershipID = ? AND Status = 'PENDING'"), eq(201))).thenReturn(1);

        when(jdbcTemplate.queryForObject(contains("SELECT FullName, Phone, Email"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "FullName", "Customer Minh",
                            "Phone", "0900000004",
                            "Email", "customer@gymcore.local"
                    )), 0);
                });

        AtomicInteger insertSequence = new AtomicInteger(0);
        when(jdbcTemplate.update(any(PreparedStatementCreator.class), any(KeyHolder.class)))
                .thenAnswer(invocation -> {
                    KeyHolder keyHolder = invocation.getArgument(1);
                    int call = insertSequence.incrementAndGet();
                    Map<String, Object> keyMap = new LinkedHashMap<>();
                    if (call == 1) {
                        keyMap.put("CustomerMembershipID", 901);
                    } else {
                        keyMap.put("PaymentID", 902);
                    }
                    keyHolder.getKeyList().add(keyMap);
                    return 1;
                });

        when(payOsService.createPaymentLink(
                eq(902),
                eq(new BigDecimal("1200000")),
                contains("Membership"),
                eq("Customer Minh"),
                eq("0900000004"),
                eq("customer@gymcore.local"),
                eq("GymCore Membership"),
                any(),
                eq(null),
                eq(null)))
                .thenReturn(new PayOsService.PayOsLink("LINK-902", "https://payos.vn/checkout/902", "PENDING"));

        when(jdbcTemplate.update(
                contains("SET PayOS_PaymentLinkId = ?"),
                eq("LINK-902"),
                eq("https://payos.vn/checkout/902"),
                eq("PENDING"),
                eq(902)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute(
                "customer-purchase-membership",
                "Bearer customer",
                Map.of("planId", 3, "paymentMethod", "PAYOS"));

        assertEquals(902, response.get("paymentId"));
        assertFalse(Boolean.TRUE.equals(response.get("reusedCheckout")));
        verify(jdbcTemplate).update(contains("SET Status = 'CANCELLED'"), eq("CANCELLED"), eq(301));
        verify(jdbcTemplate).update(contains("WHERE CustomerMembershipID = ? AND Status = 'PENDING'"), eq(201));
    }

    private ResultSet resultSet(Map<String, Object> values) throws Exception {
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value == null ? null : String.valueOf(value);
        });
        when(rs.getInt(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value == null ? 0 : ((Number) value).intValue();
        });
        when(rs.getBoolean(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value instanceof Boolean bool) {
                return bool;
            }
            return value != null && Integer.parseInt(String.valueOf(value)) > 0;
        });
        when(rs.getObject(anyString())).thenAnswer(invocation -> values.get(invocation.getArgument(0)));
        when(rs.getBigDecimal(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value instanceof BigDecimal decimal) {
                return decimal;
            }
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return null;
        });
        when(rs.getDate(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value == null) {
                return null;
            }
            if (value instanceof Date date) {
                return date;
            }
            if (value instanceof LocalDate localDate) {
                return Date.valueOf(localDate);
            }
            return null;
        });
        when(rs.getTimestamp(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value == null) {
                return null;
            }
            if (value instanceof Timestamp timestamp) {
                return timestamp;
            }
            if (value instanceof Instant instant) {
                return Timestamp.from(instant);
            }
            return null;
        });
        return rs;
    }
}
