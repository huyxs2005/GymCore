package com.gymcore.backend.modules.membership.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import com.gymcore.backend.modules.product.service.PayOsService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class MembershipServiceAdminPlanTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private PayOsService payOsService;
    private MembershipService membershipService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        payOsService = Mockito.mock(PayOsService.class);
        membershipService = new MembershipService(jdbcTemplate, currentUserService, payOsService);
    }

    @Test
    void adminGetPlans_shouldReturnAllPlans() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(9, "Admin", "ADMIN"));

        when(jdbcTemplate.query(contains("FROM dbo.MembershipPlans mp"), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 2,
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY",
                            "Price", new BigDecimal("500000.00"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", false,
                            "IsActive", true,
                            "CreatedAt", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")),
                            "UpdatedAt", Timestamp.from(Instant.parse("2026-01-02T00:00:00Z")))), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute("admin-get-plans", "Bearer admin", null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> plans = (List<Map<String, Object>>) response.get("plans");

        assertEquals(1, plans.size());
        assertEquals("GYM_ONLY", plans.get(0).get("planType"));
        assertEquals(true, plans.get(0).get("active"));
    }

    @Test
    void adminCreatePlan_shouldForceDayPassRules() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(9, "Admin", "ADMIN"));

        when(jdbcTemplate.queryForObject(
                contains("OUTPUT INSERTED.MembershipPlanID"),
                eq(Integer.class),
                any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(88);

        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(88)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 88,
                            "PlanName", "Day Pass Special",
                            "PlanType", "DAY_PASS",
                            "Price", new BigDecimal("80000.00"),
                            "DurationDays", 1,
                            "AllowsCoachBooking", false,
                            "IsActive", true,
                            "CreatedAt", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")),
                            "UpdatedAt", Timestamp.from(Instant.parse("2026-01-02T00:00:00Z")))), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute("admin-create-plan", "Bearer admin", Map.of(
                "name", "Day Pass Special",
                "planType", "DAY_PASS",
                "price", 80000,
                "durationDays", 30,
                "allowsCoachBooking", true,
                "active", true));

        @SuppressWarnings("unchecked")
        Map<String, Object> plan = (Map<String, Object>) response.get("plan");
        assertEquals("DAY_PASS", plan.get("planType"));
        assertEquals(1, plan.get("durationDays"));
        assertEquals(false, plan.get("allowsCoachBooking"));

        verify(jdbcTemplate).queryForObject(
                contains("OUTPUT INSERTED.MembershipPlanID"),
                eq(Integer.class),
                eq("Day Pass Special"),
                eq("DAY_PASS"),
                eq(new BigDecimal("80000.00")),
                eq(1),
                eq(false),
                eq(true),
                eq(9));
    }

    @Test
    void adminUpdatePlan_shouldForceGymPlusCoachRule() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(9, "Admin", "ADMIN"));

        AtomicInteger queryCount = new AtomicInteger(0);
        when(jdbcTemplate.query(contains("WHERE mp.MembershipPlanID = ?"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    int count = queryCount.incrementAndGet();
                    if (count == 1) {
                        return List.of(mapper.mapRow(resultSet(Map.of(
                                "MembershipPlanID", 5,
                                "PlanName", "Legacy Plan",
                                "PlanType", "GYM_ONLY",
                                "Price", new BigDecimal("500000.00"),
                                "DurationDays", 30,
                                "AllowsCoachBooking", false,
                                "IsActive", true,
                                "CreatedAt", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")),
                                "UpdatedAt", Timestamp.from(Instant.parse("2026-01-02T00:00:00Z")))), 0));
                    }
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "MembershipPlanID", 5,
                            "PlanName", "Coach Premium",
                            "PlanType", "GYM_PLUS_COACH",
                            "Price", new BigDecimal("1200000.00"),
                            "DurationDays", 30,
                            "AllowsCoachBooking", true,
                            "IsActive", true,
                            "CreatedAt", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")),
                            "UpdatedAt", Timestamp.from(Instant.parse("2026-01-02T00:00:00Z")))), 0));
                });

        when(jdbcTemplate.update(
                contains("UPDATE dbo.MembershipPlans"),
                any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = membershipService.execute("admin-update-plan", "Bearer admin", Map.of(
                "planId", 5,
                "body", Map.of(
                        "name", "Coach Premium",
                        "planType", "GYM_PLUS_COACH",
                        "price", 1200000,
                        "durationDays", 30,
                        "allowsCoachBooking", false,
                        "active", true)));

        @SuppressWarnings("unchecked")
        Map<String, Object> plan = (Map<String, Object>) response.get("plan");
        assertEquals("GYM_PLUS_COACH", plan.get("planType"));
        assertEquals(true, plan.get("allowsCoachBooking"));
        assertTrue(queryCount.get() >= 2);

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.MembershipPlans"),
                eq("Coach Premium"),
                eq("GYM_PLUS_COACH"),
                eq(new BigDecimal("1200000.00")),
                eq(30),
                eq(true),
                eq(true),
                eq(9),
                eq(5));
    }

    @Test
    void adminCreatePlan_shouldRejectInvalidPlanType() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(9, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                membershipService.execute("admin-create-plan", "Bearer admin", Map.of(
                        "name", "Invalid Plan",
                        "planType", "RANDOM_TYPE",
                        "price", 100000,
                        "durationDays", 10,
                        "active", true)));

        assertEquals(400, exception.getStatusCode().value());
        assertTrue(String.valueOf(exception.getReason()).contains("Plan type must be one of"));
    }

    @Test
    void adminCreatePlan_shouldRejectZeroPrice() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(9, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                membershipService.execute("admin-create-plan", "Bearer admin", Map.of(
                        "name", "Free Plan",
                        "planType", "GYM_ONLY",
                        "price", 0,
                        "durationDays", 30,
                        "active", true)));

        assertEquals(400, exception.getStatusCode().value());
        assertTrue(String.valueOf(exception.getReason()).contains("Price must be greater than 0"));
    }

    @Test
    void adminUpdatePlan_shouldRejectMissingPlanId() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(9, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                membershipService.execute("admin-update-plan", "Bearer admin", Map.of(
                        "body", Map.of(
                                "name", "Any",
                                "planType", "GYM_ONLY",
                                "price", 100000,
                                "durationDays", 30))));

        assertEquals(400, exception.getStatusCode().value());
        assertTrue(String.valueOf(exception.getReason()).contains("Membership plan ID is required"));
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
        when(rs.getTimestamp(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value instanceof Timestamp timestamp ? timestamp : null;
        });
        return rs;
    }
}
