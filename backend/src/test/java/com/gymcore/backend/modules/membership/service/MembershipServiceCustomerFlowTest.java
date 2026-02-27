package com.gymcore.backend.modules.membership.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
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
    void paymentSuccessAfterPurchase_shouldAllowReceptionQrCheckin() throws Exception {
        AtomicBoolean membershipActivated = new AtomicBoolean(false);

        // Webhook verification passes
        Mockito.doNothing().when(payOsService).verifyWebhookSignature(any(HttpHeaders.class), any(Map.class));

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
    void confirmPaymentReturn_shouldConfirmMembershipPaymentForOwner() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

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
