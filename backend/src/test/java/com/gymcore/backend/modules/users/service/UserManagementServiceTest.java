package com.gymcore.backend.modules.users.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService;
import java.sql.Date;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class UserManagementServiceTest {

    private JdbcTemplate jdbcTemplate;
    private AuthService authService;
    private UserManagementService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        authService = Mockito.mock(AuthService.class);
        service = new UserManagementService(jdbcTemplate, authService);
    }

    @Test
    void receptionSearchCustomers_shouldRejectNonReceptionist() {
        when(authService.requireAuthContext("Bearer bad"))
                .thenReturn(new AuthService.AuthContext(1, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("reception-search-customers", Map.of(
                        "authorizationHeader", "Bearer bad",
                        "query", "minh"
                )));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void receptionSearchCustomers_shouldReturnMatchedCustomers() throws Exception {
        when(authService.requireAuthContext("Bearer ok"))
                .thenReturn(new AuthService.AuthContext(2, "RECEPTIONIST", "Receptionist", "reception@gymcore.local"));

        when(jdbcTemplate.query(contains("SELECT TOP (20)"), any(RowMapper.class), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "UserID", 5,
                            "FullName", "Customer Minh",
                            "Email", "customer@gymcore.local",
                            "Phone", "0900000004",
                            "CustomerMembershipID", 11,
                            "Status", "ACTIVE",
                            "PlanName", "Gym + Coach - 6 Months",
                            "PlanType", "GYM_PLUS_COACH",
                            "StartDate", LocalDate.of(2026, 2, 1),
                            "EndDate", LocalDate.of(2026, 8, 1)
                    )), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> data = service.execute("reception-search-customers", Map.of(
                "authorizationHeader", "Bearer ok",
                "query", "minh"
        ));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(1, items.size());
        assertEquals("Customer Minh", items.get(0).get("fullName"));
    }

    @Test
    void receptionCustomerMembership_shouldReturnScheduledReason() throws Exception {
        when(authService.requireAuthContext("Bearer ok"))
                .thenReturn(new AuthService.AuthContext(2, "RECEPTIONIST", "Receptionist", "reception@gymcore.local"));

        when(jdbcTemplate.query(contains("WHERE u.UserID = ?"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "UserID", 5,
                            "FullName", "Customer Minh",
                            "Email", "customer@gymcore.local",
                            "Phone", "0900000004"
                    )), 0));
                });

        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), eq("ACTIVE")))
                .thenReturn(List.of());

        LocalDate scheduledStart = LocalDate.now().plusDays(4);
        when(jdbcTemplate.query(contains("cm.Status = ?"), any(RowMapper.class), eq(5), eq("SCHEDULED")))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "CustomerMembershipID", 12,
                            "Status", "SCHEDULED",
                            "StartDate", scheduledStart,
                            "EndDate", scheduledStart.plusDays(29),
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY"
                    )), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> data = service.execute("reception-customer-membership", Map.of(
                "authorizationHeader", "Bearer ok",
                "customerId", 5
        ));

        assertFalse(Boolean.TRUE.equals(data.get("validForCheckin")));
        assertTrue(String.valueOf(data.get("reason")).contains("not active yet"));

        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) data.get("membership");
        assertEquals("SCHEDULED", membership.get("status"));
        assertEquals(4, membership.get("daysUntilActive"));
    }

    @Test
    void receptionSearchCustomers_shouldReturnEmptyWhenQueryBlank() {
        when(authService.requireAuthContext("Bearer ok"))
                .thenReturn(new AuthService.AuthContext(2, "RECEPTIONIST", "Receptionist", "reception@gymcore.local"));

        @SuppressWarnings("unchecked")
        Map<String, Object> data = service.execute("reception-search-customers", Map.of(
                "authorizationHeader", "Bearer ok",
                "query", "   "
        ));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertTrue(items.isEmpty());
        verify(jdbcTemplate, never()).query(contains("SELECT TOP (20)"), any(RowMapper.class), any(), any(), any(), any());
    }

    @Test
    void receptionCustomerMembership_shouldReturnNotFoundWhenCustomerMissing() {
        when(authService.requireAuthContext("Bearer ok"))
                .thenReturn(new AuthService.AuthContext(2, "RECEPTIONIST", "Receptionist", "reception@gymcore.local"));
        when(jdbcTemplate.query(contains("WHERE u.UserID = ?"), any(RowMapper.class), eq(999)))
                .thenReturn(List.of());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("reception-customer-membership", Map.of(
                        "authorizationHeader", "Bearer ok",
                        "customerId", 999
                )));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Customer not found.", exception.getReason());
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
        when(rs.getObject(anyString())).thenAnswer(invocation -> values.get(invocation.getArgument(0)));
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
        return rs;
    }
}
