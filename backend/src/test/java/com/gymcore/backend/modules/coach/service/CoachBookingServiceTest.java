package com.gymcore.backend.modules.coach.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService;
import java.time.LocalDate;
import java.util.LinkedHashMap;
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

class CoachBookingServiceTest {

    private JdbcTemplate jdbcTemplate;
    private AuthService authService;
    private CoachBookingService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        authService = Mockito.mock(AuthService.class);
        service = new CoachBookingService(jdbcTemplate, authService);
    }

    @Test
    void customerCreateBookingRequest_shouldRejectWhenNoActiveGymCoachMembership() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.queryForObject(contains("SELECT TOP 1 cm.CustomerMembershipID"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class)))
                .thenThrow(new EmptyResultDataAccessException(1));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-create-booking-request",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "coachId", 20,
                        "startDate", "2026-03-01",
                        "endDate", "2026-03-31",
                        "slots", List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("ACTIVE Gym + Coach membership"));
    }

    @Test
    void customerRescheduleSession_shouldCreatePendingRequestInsteadOfImmediateSessionChange() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("SELECT CoachID, SessionDate, TimeSlotID, Status, CancelReason"),
                any(RowMapper.class),
                eq(222),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "coachId", 20,
                        "sessionDate", LocalDate.now().plusDays(2),
                        "timeSlotId", 1,
                        "status", "SCHEDULED",
                        "cancelReason", null)));

        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.CoachWeeklyAvailability"),
                eq(Integer.class),
                eq(20)))
                .thenReturn(56);

        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.CoachWeeklyAvailability"),
                eq(Integer.class),
                eq(20), eq(LocalDate.now().plusDays(3).getDayOfWeek().getValue()), eq(2)))
                .thenReturn(1);

        when(jdbcTemplate.query(
                contains("SELECT PTSessionID FROM dbo.PTSessions"),
                any(RowMapper.class),
                eq(20),
                eq(LocalDate.now().plusDays(3)),
                eq(2),
                eq(222)))
                .thenReturn(List.of());

        when(jdbcTemplate.update(contains("SET CancelReason"), anyString(), eq(222), eq(10))).thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute("customer-reschedule-session", Map.of(
                "authorizationHeader", "Bearer customer",
                "sessionId", 222,
                "body", Map.of(
                        "sessionDate", LocalDate.now().plusDays(3).toString(),
                        "timeSlotId", 2,
                        "reason", "Need to move this session")));

        assertEquals("PENDING_COACH_APPROVAL", result.get("status"));
        assertEquals(222, result.get("sessionId"));
        assertEquals(2, result.get("requestedTimeSlotId"));
        verify(jdbcTemplate).update(contains("SET CancelReason"), anyString(), eq(222), eq(10));
    }

    @Test
    void customerRescheduleSession_shouldRejectWhenRequestAlreadyPending() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("SELECT CoachID, SessionDate, TimeSlotID, Status, CancelReason"),
                any(RowMapper.class),
                eq(222),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "coachId", 20,
                        "sessionDate", LocalDate.now().plusDays(2),
                        "timeSlotId", 1,
                        "status", "SCHEDULED",
                        "cancelReason", "RESCHEDULE_REQUEST|2030-03-03|2|Already sent")));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-reschedule-session",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "sessionId", 222,
                        "body", Map.of(
                                "sessionDate", LocalDate.now().plusDays(4).toString(),
                                "timeSlotId", 3))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("already pending"));
    }

    @Test
    void customerRescheduleSession_shouldRejectWhenCoachNotAvailableForRequestedSlot() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("SELECT CoachID, SessionDate, TimeSlotID, Status, CancelReason"),
                any(RowMapper.class),
                eq(333),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "coachId", 20,
                        "sessionDate", LocalDate.now().plusDays(2),
                        "timeSlotId", 1,
                        "status", "SCHEDULED",
                        "cancelReason", null)));

        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.CoachWeeklyAvailability"),
                eq(Integer.class),
                eq(20)))
                .thenReturn(56);

        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.CoachWeeklyAvailability"),
                eq(Integer.class),
                eq(20), eq(LocalDate.now().plusDays(3).getDayOfWeek().getValue()), eq(2)))
                .thenReturn(0);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-reschedule-session",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "sessionId", 333,
                        "body", Map.of(
                                "sessionDate", LocalDate.now().plusDays(3).toString(),
                                "timeSlotId", 2))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("not available"));
    }

    @Test
    void coachApproveRescheduleRequest_shouldRejectWhenNoPendingRequestMeta() {
        when(authService.requireAuthContext("Bearer coach"))
                .thenReturn(new AuthService.AuthContext(20, "COACH", "Coach Alex", "coach@gymcore.local"));

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessions"),
                any(RowMapper.class),
                eq(444),
                eq(20)))
                .thenReturn(List.of(mapOfNullable(
                        "ptSessionId", 444,
                        "status", "SCHEDULED",
                        "cancelReason", null,
                        "sessionDate", LocalDate.now().plusDays(2),
                        "timeSlotId", 1)));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "coach-approve-reschedule-request",
                Map.of(
                        "authorizationHeader", "Bearer coach",
                        "sessionId", 444)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("No pending reschedule request"));
    }

    @Test
    void coachDenyRescheduleRequest_shouldWriteDeniedMetaAndReturnDeniedStatus() {
        when(authService.requireAuthContext("Bearer coach"))
                .thenReturn(new AuthService.AuthContext(20, "COACH", "Coach Alex", "coach@gymcore.local"));

        when(jdbcTemplate.query(
                contains("SELECT CancelReason, Status"),
                any(RowMapper.class),
                eq(555),
                eq(20)))
                .thenReturn(List.of(mapOfNullable(
                        "status", "SCHEDULED",
                        "cancelReason", "RESCHEDULE_REQUEST|2030-03-03|2|Need to move")));

        when(jdbcTemplate.update(contains("SET CancelReason"), contains("RESCHEDULE_DENIED|2030-03-03|2|Conflict"),
                eq(555), eq(20)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "coach-deny-reschedule-request",
                Map.of(
                        "authorizationHeader", "Bearer coach",
                        "sessionId", 555,
                        "body", Map.of("reason", "Conflict")));

        assertEquals("DENIED", result.get("status"));
        verify(jdbcTemplate).update(contains("SET CancelReason"), contains("RESCHEDULE_DENIED|2030-03-03|2|Conflict"),
                eq(555), eq(20));
    }

    @Test
    void customerMatchCoaches_shouldSplitFullAndPartialMatches() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.Coaches"), any(RowMapper.class)))
                .thenReturn(List.of(
                        mapOfNullable("coachId", 501, "fullName", "Coach Full", "email", "full@gymcore.local",
                                "phone", "1", "avatarUrl", null, "experienceYears", 3, "bio", "full",
                                "averageRating", 5.0, "reviewCount", 10),
                        mapOfNullable("coachId", 502, "fullName", "Coach Partial", "email", "partial@gymcore.local",
                                "phone", "2", "avatarUrl", null, "experienceYears", 2, "bio", "partial",
                                "averageRating", 4.5, "reviewCount", 7)));

        when(jdbcTemplate.query(contains("FROM dbo.CoachWeeklyAvailability"), any(RowMapper.class), eq(501)))
                .thenReturn(List.of(
                        Map.of("dayOfWeek", 1, "timeSlotId", 1),
                        Map.of("dayOfWeek", 3, "timeSlotId", 2)));
        when(jdbcTemplate.query(contains("FROM dbo.CoachWeeklyAvailability"), any(RowMapper.class), eq(502)))
                .thenReturn(List.of(
                        Map.of("dayOfWeek", 1, "timeSlotId", 1)));

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessions"),
                any(RowMapper.class),
                eq(501),
                any(LocalDate.class),
                any(LocalDate.class)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessions"),
                any(RowMapper.class),
                eq(502),
                any(LocalDate.class),
                any(LocalDate.class)))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute("customer-match-coaches", Map.of(
                "authorizationHeader", "Bearer customer",
                "startDate", "2026-03-01",
                "endDate", "2026-03-31",
                "slots", List.of(
                        Map.of("dayOfWeek", 1, "timeSlotId", 1),
                        Map.of("dayOfWeek", 3, "timeSlotId", 2))));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fullMatches = (List<Map<String, Object>>) result.get("fullMatches");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> partialMatches = (List<Map<String, Object>>) result.get("partialMatches");

        assertEquals(1, fullMatches.size());
        assertEquals(501, fullMatches.getFirst().get("coachId"));
        assertEquals(1, partialMatches.size());
        assertEquals(502, partialMatches.getFirst().get("coachId"));
    }

    private Map<String, Object> mapOfNullable(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return map;
    }
}
