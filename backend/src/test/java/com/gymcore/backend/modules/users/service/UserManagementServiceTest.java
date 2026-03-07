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
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class UserManagementServiceTest {

    private JdbcTemplate jdbcTemplate;
    private AuthService authService;
    private CurrentUserService currentUserService;
    private PasswordEncoder passwordEncoder;
    private UserManagementService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        authService = Mockito.mock(AuthService.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        passwordEncoder = Mockito.mock(PasswordEncoder.class);
        service = new UserManagementService(jdbcTemplate, authService, currentUserService, passwordEncoder);
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

    @Test
    void adminCreateStaff_shouldRejectCustomerRole() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-create-staff", Map.of(
                        "authorizationHeader", "Bearer admin",
                        "role", "CUSTOMER"
                )));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Admin can create only ADMIN, COACH, or RECEPTIONIST accounts.", exception.getReason());
    }

    @Test
    void adminCreateStaff_shouldCreateReceptionistAccount() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(passwordEncoder.encode("Reception123!")).thenReturn("ENCODED_PASSWORD");
        when(jdbcTemplate.queryForObject(contains("LOWER(Email)"), eq(Integer.class), eq("new.reception@gymcore.local")))
                .thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("PhoneNormalized"), eq(Integer.class), eq("0900000099")))
                .thenReturn(0);
        when(jdbcTemplate.queryForObject(eq("SELECT RoleID FROM dbo.Roles WHERE RoleName = ?"), eq(Integer.class), eq("Receptionist")))
                .thenReturn(7);
        when(jdbcTemplate.queryForObject(contains("OUTPUT INSERTED.UserID"), eq(Integer.class), eq(7), eq("Reception New"),
                eq("new.reception@gymcore.local"), eq("0900000099"), eq("ENCODED_PASSWORD")))
                .thenReturn(99);
        when(jdbcTemplate.query(contains("CASE"), any(RowMapper.class), eq(99)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOf(
                            "UserID", 99,
                            "FullName", "Reception New",
                            "Email", "new.reception@gymcore.local",
                            "Phone", "0900000099",
                            "IsActive", true,
                            "IsLocked", false,
                            "LockedAt", null,
                            "LockReason", null,
                            "IsEmailVerified", true,
                            "EmailVerifiedAt", null,
                            "CreatedAt", Timestamp.valueOf("2026-03-07 09:00:00"),
                            "RoleName", "Receptionist",
                            "DateOfBirth", null,
                            "Gender", null,
                            "ExperienceYears", null,
                            "Bio", null,
                            "AuthMode", "PASSWORD"
                    )), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> result = service.execute("admin-create-staff", Map.of(
                "authorizationHeader", "Bearer admin",
                "fullName", "Reception New",
                "email", "new.reception@gymcore.local",
                "phone", "0900000099",
                "role", "RECEPTIONIST",
                "password", "Reception123!",
                "confirmPassword", "Reception123!"
        ));

        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) result.get("user");
        assertEquals(99, user.get("userId"));
        assertEquals("Reception New", user.get("fullName"));
        verify(passwordEncoder).encode("Reception123!");
    }

    @Test
    void adminGetUsers_shouldRejectCustomerRoleFilter() {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-get-users", Map.of(
                        "authorizationHeader", "Bearer admin",
                        "role", "CUSTOMER"
                )));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Role filter is invalid.", exception.getReason());
    }

    @Test
    void adminUpdateStaff_shouldRejectCustomerAccount() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
        when(jdbcTemplate.query(contains("WHERE u.UserID = ?"), any(RowMapper.class), eq(44)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOf(
                            "UserID", 44,
                            "FullName", "Customer Minh",
                            "Email", "customer@gymcore.local",
                            "Phone", "0900000004",
                            "RoleName", "Customer",
                            "IsActive", true,
                            "IsLocked", false,
                            "DateOfBirth", null,
                            "Gender", null,
                            "ExperienceYears", null,
                            "Bio", null
                    )), 0));
                });

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-update-staff", Map.of(
                        "authorizationHeader", "Bearer admin",
                        "userId", 44,
                        "body", Map.of("fullName", "Customer Minh")
                )));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Only staff accounts are managed here.", exception.getReason());
    }

    @Test
    void adminLockUser_shouldRejectSelfLock() throws Exception {
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(3, "Admin", "ADMIN"));
        when(jdbcTemplate.query(contains("WHERE u.UserID = ?"), any(RowMapper.class), eq(3)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOf(
                            "UserID", 3,
                            "FullName", "Admin GymCore",
                            "Email", "admin@gymcore.local",
                            "Phone", "0900000001",
                            "RoleName", "Admin",
                            "IsActive", true,
                            "IsLocked", false,
                            "DateOfBirth", null,
                            "Gender", null,
                            "ExperienceYears", null,
                            "Bio", null
                    )), 0));
                });

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("admin-lock-user", Map.of(
                        "authorizationHeader", "Bearer admin",
                        "userId", 3,
                        "body", Map.of("reason", "Policy violation")
                )));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Admin cannot lock the current account.", exception.getReason());
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
            return value instanceof Boolean bool ? bool : value != null && Boolean.parseBoolean(String.valueOf(value));
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
        when(rs.getTimestamp(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value == null) {
                return null;
            }
            if (value instanceof Timestamp timestamp) {
                return timestamp;
            }
            if (value instanceof LocalDate localDate) {
                return Timestamp.valueOf(localDate.atStartOfDay());
            }
            return Timestamp.valueOf(String.valueOf(value));
        });
        return rs;
    }

    private Map<String, Object> mapOf(Object... entries) {
        java.util.LinkedHashMap<String, Object> values = new java.util.LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) {
            values.put(String.valueOf(entries[i]), entries[i + 1]);
        }
        return values;
    }
}
