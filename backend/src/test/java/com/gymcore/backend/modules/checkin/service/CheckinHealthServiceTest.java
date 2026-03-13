package com.gymcore.backend.modules.checkin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class CheckinHealthServiceTest {

    private JdbcTemplate jdbcTemplate;
    private AuthService authService;
    private CheckinHealthService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        authService = Mockito.mock(AuthService.class);
        service = new CheckinHealthService(jdbcTemplate, authService);
    }

    @Test
    void receptionScanCheckin_shouldInsertWhenMembershipActive() throws Exception {
        when(authService.requireAuthContext("Bearer ok"))
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
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "CustomerMembershipID", 11,
                            "Status", "ACTIVE",
                            "StartDate", LocalDate.of(2026, 2, 1),
                            "EndDate", LocalDate.of(2026, 8, 1),
                            "PlanName", "Gym + Coach - 6 Months",
                            "PlanType", "GYM_PLUS_COACH"
                    )), 0));
                });

        when(jdbcTemplate.update(contains("INSERT INTO dbo.CheckIns"), eq(5), eq(11), eq(2))).thenReturn(1);

        when(jdbcTemplate.queryForObject(contains("FROM dbo.CheckIns ci"), any(RowMapper.class), eq(5), eq(11), eq(2)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "CheckInID", 100,
                            "CheckInTime", Timestamp.from(Instant.parse("2026-02-17T10:00:00Z"))
                    )), 0);
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> data = service.execute("reception-scan-checkin", Map.of(
                "authorizationHeader", "Bearer ok",
                "customerId", 5
        ));

        assertEquals(100, data.get("checkInId"));
        assertEquals("2026-02-17T10:00:00Z", data.get("checkInTime"));

        @SuppressWarnings("unchecked")
        Map<String, Object> customer = (Map<String, Object>) data.get("customer");
        assertEquals(5, customer.get("customerId"));
        assertEquals("Customer Minh", customer.get("fullName"));
        verify(jdbcTemplate).update(contains("INSERT INTO dbo.CheckIns"), eq(5), eq(11), eq(2));
    }

    @Test
    void receptionScanCheckin_shouldReturnBadRequestWhenMembershipScheduled() throws Exception {
        when(authService.requireAuthContext("Bearer ok"))
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
                .thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'SCHEDULED'"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "CustomerMembershipID", 12,
                            "Status", "SCHEDULED",
                            "StartDate", LocalDate.of(2026, 8, 2),
                            "EndDate", LocalDate.of(2026, 9, 1),
                            "PlanName", "Gym Only - 1 Month",
                            "PlanType", "GYM_ONLY"
                    )), 0));
                });

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("reception-scan-checkin", Map.of(
                        "authorizationHeader", "Bearer ok",
                        "customerId", 5
                )));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertNotNull(exception.getReason());
        assertTrue(exception.getReason().contains("not active yet"));
        verify(jdbcTemplate, never()).update(contains("INSERT INTO dbo.CheckIns"), any(), any(), any());
    }

    @Test
    void receptionValidateMembership_shouldReturnInvalidReasonWhenNoMembership() throws Exception {
        when(authService.requireAuthContext("Bearer ok"))
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

        when(jdbcTemplate.query(contains("cm.Status = 'ACTIVE'"), any(RowMapper.class), eq(5))).thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'SCHEDULED'"), any(RowMapper.class), eq(5))).thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'EXPIRED'"), any(RowMapper.class), eq(5))).thenReturn(List.of());
        when(jdbcTemplate.query(contains("cm.Status = 'PENDING'"), any(RowMapper.class), eq(5))).thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> data = service.execute("reception-validate-membership", Map.of(
                "authorizationHeader", "Bearer ok",
                "customerId", 5
        ));

        assertFalse(Boolean.TRUE.equals(data.get("valid")));
        assertEquals("Customer does not have a valid membership.", data.get("reason"));
    }

    @Test
    void receptionScanCheckin_shouldRejectWhenCustomerReferenceMissing() {
        when(authService.requireAuthContext("Bearer ok"))
                .thenReturn(new AuthService.AuthContext(2, "RECEPTIONIST", "Receptionist GymCore", "reception@gymcore.local"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("reception-scan-checkin", Map.of("authorizationHeader", "Bearer ok")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Provide customerId or qrCodeToken.", exception.getReason());
    }

    @Test
    void receptionScanCheckin_shouldRejectWhenQrTokenInvalid() {
        when(authService.requireAuthContext("Bearer ok"))
                .thenReturn(new AuthService.AuthContext(2, "RECEPTIONIST", "Receptionist GymCore", "reception@gymcore.local"));
        when(jdbcTemplate.queryForObject(contains("WHERE u.QrCodeToken = ?"), any(RowMapper.class), eq("bad-token")))
                .thenThrow(new EmptyResultDataAccessException(1));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("reception-scan-checkin", Map.of(
                        "authorizationHeader", "Bearer ok",
                        "qrCodeToken", "bad-token"
                )));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("QR code is invalid"));
    }

    @Test
    void receptionScanCheckin_shouldRejectNonReceptionistRole() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(5, "CUSTOMER", "Customer", "customer@gymcore.local"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("reception-scan-checkin", Map.of(
                        "authorizationHeader", "Bearer customer",
                        "customerId", 5
                )));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        assertEquals("Only receptionist can perform this action.", exception.getReason());
    }

    @Test
    void customerGetProgressHub_shouldAggregateCurrentHealthHistoryAndCoachNotes() throws Exception {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(5, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.queryForObject(contains("FROM dbo.CustomerHealthCurrent"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "HeightCm", 170.5,
                            "WeightKg", 68.2,
                            "BMI", 23.4,
                            "UpdatedAt", Timestamp.from(Instant.parse("2026-03-10T08:00:00Z"))
                    )), 0);
                });

        when(jdbcTemplate.query(contains("FROM dbo.CustomerHealthHistory"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return List.of(
                            mapper.mapRow(resultSet(Map.of(
                                    "HeightCm", 170.5,
                                    "WeightKg", 68.2,
                                    "BMI", 23.4,
                                    "RecordedAt", Timestamp.from(Instant.parse("2026-03-10T08:00:00Z"))
                            )), 0),
                            mapper.mapRow(resultSet(Map.of(
                                    "HeightCm", 170.5,
                                    "WeightKg", 69.0,
                                    "BMI", 23.7,
                                    "RecordedAt", Timestamp.from(Instant.parse("2026-02-28T08:00:00Z"))
                            )), 1));
                });

        when(jdbcTemplate.query(contains("FROM dbo.PTSessionNotes"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "PTSessionNoteID", 12,
                            "NoteContent", "Form is improving each week.",
                            "CreatedAt", Timestamp.from(Instant.parse("2026-03-11T10:30:00Z")),
                            "SessionDate", LocalDate.of(2026, 3, 11),
                            "CoachName", "Coach Lan"
                    )), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> data = service.execute("customer-get-progress-hub", Map.of(
                "authorizationHeader", "Bearer customer"
        ));

        @SuppressWarnings("unchecked")
        Map<String, Object> currentHealth = (Map<String, Object>) data.get("currentHealth");
        assertEquals("2026-03-10T08:00:00Z", currentHealth.get("updatedAt"));
        assertEquals("progress-hub.v1", data.get("contractVersion"));
        assertEquals(currentHealth, data.get("currentSnapshot"));

        @SuppressWarnings("unchecked")
        Map<String, Object> healthHistory = (Map<String, Object>) data.get("healthHistory");
        assertEquals(2, ((List<?>) healthHistory.get("items")).size());

        @SuppressWarnings("unchecked")
        Map<String, Object> historySummary = (Map<String, Object>) data.get("historySummary");
        assertEquals(2, historySummary.get("totalRecords"));
        assertEquals("2026-03-10T08:00:00Z", historySummary.get("latestRecordedAt"));

        @SuppressWarnings("unchecked")
        Map<String, Object> coachNotes = (Map<String, Object>) data.get("coachNotes");
        assertEquals(1, ((List<?>) coachNotes.get("items")).size());
        assertEquals(coachNotes, data.get("recentCoachNotes"));

        @SuppressWarnings("unchecked")
        Map<String, Object> latestCoachingSignal = (Map<String, Object>) data.get("latestCoachingSignal");
        assertEquals("COACH_NOTE", latestCoachingSignal.get("sourceType"));
        assertEquals("Form is improving each week.", latestCoachingSignal.get("summary"));
        assertEquals("Coach Lan", latestCoachingSignal.get("coachName"));

        @SuppressWarnings("unchecked")
        Map<String, Object> followUp = (Map<String, Object>) data.get("followUp");
        assertEquals(2, followUp.get("historyCount"));
        assertEquals(1, followUp.get("recentCoachNoteCount"));
        assertEquals("2026-03-11T10:30:00Z", followUp.get("lastProgressSignalAt"));
        assertEquals(Boolean.TRUE, followUp.get("hasCurrentHealth"));
        assertEquals(Boolean.TRUE, followUp.get("readOnly"));
        assertEquals(Boolean.FALSE, followUp.get("customerCanWriteProgress"));
        assertEquals(Boolean.FALSE, followUp.get("customerCanWriteCoachNotes"));
        assertEquals("REVIEW_LATEST_COACH_NOTE", followUp.get("recommendedFocus"));
        verify(jdbcTemplate, never()).update(contains("INSERT INTO dbo.CustomerHealthHistory"), any(), any(), any());
        verify(jdbcTemplate, never()).update(contains("INSERT INTO dbo.CheckIns"), any(), any(), any());
    }

    @Test
    void customerGetProgressHub_shouldReturnExplicitEmptyStateWithoutWrites() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(5, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));
        when(jdbcTemplate.queryForObject(contains("FROM dbo.CustomerHealthCurrent"), any(RowMapper.class), eq(5)))
                .thenThrow(new EmptyResultDataAccessException(1));
        when(jdbcTemplate.query(contains("FROM dbo.CustomerHealthHistory"), any(RowMapper.class), eq(5)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(contains("FROM dbo.PTSessionNotes"), any(RowMapper.class), eq(5)))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> data = service.execute("customer-get-progress-hub", Map.of(
                "authorizationHeader", "Bearer customer"
        ));

        assertEquals(Map.of(), data.get("currentHealth"));
        assertEquals(Map.of(), data.get("currentSnapshot"));

        @SuppressWarnings("unchecked")
        Map<String, Object> historySummary = (Map<String, Object>) data.get("historySummary");
        assertEquals(0, historySummary.get("totalRecords"));
        assertEquals(null, historySummary.get("latestRecordedAt"));

        @SuppressWarnings("unchecked")
        Map<String, Object> latestCoachingSignal = (Map<String, Object>) data.get("latestCoachingSignal");
        assertEquals("HEALTH_SNAPSHOT", latestCoachingSignal.get("sourceType"));
        assertEquals("No coaching signal recorded yet.", latestCoachingSignal.get("summary"));
        assertEquals(null, latestCoachingSignal.get("recordedAt"));

        @SuppressWarnings("unchecked")
        Map<String, Object> followUp = (Map<String, Object>) data.get("followUp");
        assertEquals("COMPLETE_BASELINE_CHECK_IN", followUp.get("recommendedFocus"));
        assertEquals(Boolean.TRUE, followUp.get("readOnly"));
        verify(jdbcTemplate, never()).update(contains("INSERT INTO dbo.CustomerHealthHistory"), any(), any(), any());
        verify(jdbcTemplate, never()).update(contains("INSERT INTO dbo.CheckIns"), any(), any(), any());
    }

    @Test
    void customerGetProgressHub_shouldStayCompatibleWithExistingCustomerHealthReads() throws Exception {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(5, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.queryForObject(contains("FROM dbo.CustomerHealthCurrent"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "HeightCm", 168.0,
                            "WeightKg", 64.5,
                            "BMI", 22.9,
                            "UpdatedAt", Timestamp.from(Instant.parse("2026-03-08T09:15:00Z"))
                    )), 0);
                });
        when(jdbcTemplate.query(contains("FROM dbo.CustomerHealthHistory"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "HeightCm", 168.0,
                            "WeightKg", 64.5,
                            "BMI", 22.9,
                            "RecordedAt", Timestamp.from(Instant.parse("2026-03-08T09:15:00Z"))
                    )), 0));
                });
        when(jdbcTemplate.query(contains("FROM dbo.PTSessionNotes"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "PTSessionNoteID", 21,
                            "NoteContent", "Keep the same tempo for squats.",
                            "CreatedAt", Timestamp.from(Instant.parse("2026-03-09T09:00:00Z")),
                            "SessionDate", LocalDate.of(2026, 3, 9),
                            "CoachName", "Coach Nam"
                    )), 0));
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> legacyCurrent = service.execute("customer-get-health-current", Map.of(
                "authorizationHeader", "Bearer customer"
        ));
        @SuppressWarnings("unchecked")
        Map<String, Object> legacyHistory = service.execute("customer-get-health-history", Map.of(
                "authorizationHeader", "Bearer customer"
        ));
        @SuppressWarnings("unchecked")
        Map<String, Object> legacyNotes = service.execute("customer-get-coach-notes", Map.of(
                "authorizationHeader", "Bearer customer"
        ));
        @SuppressWarnings("unchecked")
        Map<String, Object> aggregate = service.execute("customer-get-progress-hub", Map.of(
                "authorizationHeader", "Bearer customer"
        ));

        assertEquals(legacyCurrent, aggregate.get("currentHealth"));
        assertEquals(legacyHistory, aggregate.get("healthHistory"));
        assertEquals(legacyNotes, aggregate.get("coachNotes"));
        verify(jdbcTemplate, never()).update(contains("INSERT INTO dbo.CustomerHealthHistory"), any(), any(), any());
        verify(jdbcTemplate, never()).update(contains("INSERT INTO dbo.CheckIns"), any(), any(), any());
    }

    private ResultSet resultSet(Map<String, Object> values) throws Exception {
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value == null ? null : String.valueOf(value);
        });
        when(rs.getBigDecimal(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value == null) {
                return null;
            }
            if (value instanceof java.math.BigDecimal bigDecimal) {
                return bigDecimal;
            }
            if (value instanceof Number number) {
                return java.math.BigDecimal.valueOf(number.doubleValue());
            }
            return null;
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
