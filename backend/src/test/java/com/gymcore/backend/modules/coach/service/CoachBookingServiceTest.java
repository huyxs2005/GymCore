package com.gymcore.backend.modules.coach.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.auth.service.AuthService;
import java.sql.ResultSet;
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
    private UserNotificationService notificationService;
    private CoachBookingService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        authService = Mockito.mock(AuthService.class);
        notificationService = Mockito.mock(UserNotificationService.class);
        service = new CoachBookingService(jdbcTemplate, authService, notificationService);
    }

    @Test
    void customerCreateBookingRequest_shouldRejectWhenNoActiveGymCoachMembership() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.PTRecurringRequests"), any(RowMapper.class), eq(10)))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("SELECT TOP 1 cm.CustomerMembershipID"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class)))
                .thenThrow(new EmptyResultDataAccessException(1));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-create-booking-request",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "coachId", 20,
                        "endDate", "2026-03-31",
                        "slots", List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("ACTIVE Gym + Coach membership"));
    }

    @Test
    void customerCreateBookingRequest_shouldRejectWhenPendingPtRequestAlreadyExists() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.PTRecurringRequests"), any(RowMapper.class), eq(10)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = Mockito.mock(ResultSet.class);
                    when(rs.getString("Status")).thenReturn("PENDING");
                    when(rs.getDate("StartDate")).thenReturn(java.sql.Date.valueOf(LocalDate.now().plusDays(7)));
                    when(rs.getDate("EndDate")).thenReturn(java.sql.Date.valueOf(LocalDate.now().plusDays(35)));
                    when(rs.getInt("CoachID")).thenReturn(20);
                    return List.of(mapper.mapRow(rs, 0));
                });

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-create-booking-request",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "coachId", 20,
                        "endDate", "2026-03-31",
                        "slots", List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("pending coach approval"));
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
    void customerGetMySchedule_shouldKeepCancelledSessionsVisibleForReasonReview() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessions s"),
                any(RowMapper.class),
                eq(10)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTSessionID", 321,
                            "PTRequestID", 44,
                            "CoachID", 20,
                            "CoachName", "Coach Alex",
                            "CoachPhone", "0900000003",
                            "SessionDate", LocalDate.of(2026, 3, 18),
                            "DayOfWeek", 3,
                            "TimeSlotID", 1,
                            "SlotIndex", 1,
                            "StartTime", java.sql.Time.valueOf("07:00:00"),
                            "EndTime", java.sql.Time.valueOf("08:30:00"),
                            "Status", "CANCELLED",
                            "CancelReason", "Coach had an emergency meeting")), 0));
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessionNotes n"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(
                contains("WHERE r.CustomerID = ? AND r.Status = 'PENDING'"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(
                contains("COL_LENGTH('dbo.PTRecurringRequests', 'DenyReason')"),
                eq(Integer.class)))
                .thenReturn(1);

        when(jdbcTemplate.query(
                contains("WHERE r.CustomerID = ? AND r.Status = 'DENIED'"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "customer-get-my-schedule",
                Map.of("authorizationHeader", "Bearer customer"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertFalse(items.isEmpty());
        assertEquals("CANCELLED", items.get(0).get("status"));
        assertEquals("Coach had an emergency meeting", items.get(0).get("cancelReason"));
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
    void coachGetRescheduleRequests_shouldExposeCustomerReason() {
        when(authService.requireAuthContext("Bearer coach"))
                .thenReturn(new AuthService.AuthContext(20, "COACH", "Coach Alex", "coach@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.TimeSlots"), any(RowMapper.class)))
                .thenReturn(List.of(
                        mapOfNullable("timeSlotId", 1, "slotIndex", 1, "startTime", "07:00:00", "endTime", "08:30:00"),
                        mapOfNullable("timeSlotId", 2, "slotIndex", 2, "startTime", "08:30:00", "endTime", "10:00:00")));

        when(jdbcTemplate.query(
                contains("WHERE s.CoachID = ? AND s.Status = 'SCHEDULED' AND s.CancelReason LIKE ?"),
                any(RowMapper.class),
                eq(20),
                contains("RESCHEDULE_REQUEST|")))
                .thenReturn(List.of(mapOfNullable(
                        "ptSessionId", 88,
                        "customerId", 10,
                        "customerName", "Customer Minh",
                        "customerEmail", "customer@gymcore.local",
                        "customerPhone", "0900000004",
                        "currentSessionDate", "2030-03-01",
                        "currentTimeSlotId", 1,
                        "cancelReason", "RESCHEDULE_REQUEST|2030-03-04|2|Need a later slot")));

        when(jdbcTemplate.queryForObject(contains("FROM dbo.CoachWeeklyAvailability"), eq(Integer.class), eq(20)))
                .thenReturn(56);
        when(jdbcTemplate.queryForObject(
                contains("WHERE CoachID = ? AND DayOfWeek = ? AND TimeSlotID = ? AND IsAvailable = 1"),
                eq(Integer.class), eq(20), eq(1), eq(2)))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PTSessions"), eq(Integer.class), eq(20),
                eq(LocalDate.of(2030, 3, 4)), eq(2), eq(88)))
                .thenReturn(0);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "coach-get-reschedule-requests",
                Map.of("authorizationHeader", "Bearer coach"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertEquals(1, items.size());
        assertEquals("Need a later slot", items.get(0).get("reason"));
    }

    @Test
    void customerMatchCoaches_shouldSplitFullAndPartialMatches() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.PTRecurringRequests"), any(RowMapper.class), eq(10)))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("SELECT TOP 1 cm.CustomerMembershipID"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = Mockito.mock(ResultSet.class);
                    when(rs.getInt("CustomerMembershipID")).thenReturn(77);
                    when(rs.getBoolean("AllowsCoachBooking")).thenReturn(true);
                    return mapper.mapRow(rs, 0);
                });

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
        verify(jdbcTemplate).queryForObject(contains("mp.PlanType = 'GYM_PLUS_COACH'"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    void customerMatchCoaches_shouldRejectWhenNoActiveGymCoachMembership() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.PTRecurringRequests"), any(RowMapper.class), eq(10)))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("SELECT TOP 1 cm.CustomerMembershipID"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class)))
                .thenThrow(new EmptyResultDataAccessException(1));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-match-coaches",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "endDate", "2026-03-31",
                        "slots", List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("ACTIVE Gym + Coach membership"));
    }

    @Test
    void customerMatchCoaches_shouldRejectWhenApprovedPtStillActive() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.PTRecurringRequests"), any(RowMapper.class), eq(10)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = Mockito.mock(ResultSet.class);
                    when(rs.getString("Status")).thenReturn("APPROVED");
                    when(rs.getDate("StartDate")).thenReturn(java.sql.Date.valueOf(LocalDate.now().minusDays(2)));
                    when(rs.getDate("EndDate")).thenReturn(java.sql.Date.valueOf(LocalDate.now().plusDays(21)));
                    when(rs.getInt("CoachID")).thenReturn(20);
                    return List.of(mapper.mapRow(rs, 0));
                });

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-match-coaches",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "endDate", "2026-03-31",
                        "slots", List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("active PT schedule"));
    }

    @Test
    void coachApprovePtRequest_shouldMoveStartDateToNextMondayAfterApproval() {
        LocalDate approvalDate = LocalDate.now();
        LocalDate expectedStartDate = approvalDate.plusDays(8 - approvalDate.getDayOfWeek().getValue());
        LocalDate endDate = expectedStartDate.plusDays(21);

        when(authService.requireAuthContext("Bearer coach"))
                .thenReturn(new AuthService.AuthContext(20, "COACH", "Coach Alex", "coach@gymcore.local"));

        when(jdbcTemplate.query(
                contains("SELECT CustomerID, CustomerMembershipID, StartDate, EndDate, Status FROM dbo.PTRecurringRequests"),
                any(RowMapper.class),
                eq(900),
                eq(20)))
                .thenReturn(List.of(mapOfNullable(
                        "customerId", 10,
                        "customerMembershipId", 77,
                        "startDate", LocalDate.now().plusDays(7),
                        "endDate", endDate,
                        "status", "PENDING")));

        when(jdbcTemplate.query(
                contains("SELECT DayOfWeek, TimeSlotID FROM dbo.PTRequestSlots"),
                any(RowMapper.class),
                eq(900)))
                .thenReturn(List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)));

        when(jdbcTemplate.query(
                contains("SELECT cm.CustomerMembershipID, mp.AllowsCoachBooking"),
                any(RowMapper.class),
                eq(10),
                eq(77),
                eq(expectedStartDate),
                eq(endDate)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = Mockito.mock(ResultSet.class);
                    when(rs.getInt("CustomerMembershipID")).thenReturn(77);
                    when(rs.getBoolean("AllowsCoachBooking")).thenReturn(true);
                    return List.of(mapper.mapRow(rs, 0));
                });

        when(jdbcTemplate.update(contains("UPDATE dbo.PTRecurringRequests SET StartDate = ?"), eq(expectedStartDate), eq(900)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "coach-approve-pt-request",
                Map.of(
                        "authorizationHeader", "Bearer coach",
                        "requestId", 900));

        assertEquals("APPROVED", result.get("status"));
        assertEquals(expectedStartDate.toString(), result.get("startDate"));
        assertEquals(endDate.toString(), result.get("endDate"));
        verify(jdbcTemplate).query(contains("mp.PlanType = 'GYM_PLUS_COACH'"), any(RowMapper.class),
                eq(10), eq(77), eq(expectedStartDate), eq(endDate));
        verify(jdbcTemplate).update(contains("UPDATE dbo.PTRecurringRequests SET StartDate = ?"), eq(expectedStartDate), eq(900));
    }

    @Test
    void customerCancelSession_shouldNotifyCoach() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessions s"),
                any(RowMapper.class),
                eq(222)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "PTSessionID", 222,
                            "CustomerID", 10,
                            "CoachID", 20,
                            "CustomerName", "Customer Minh",
                            "CoachName", "Coach Alex",
                            "SessionDate", LocalDate.now().plusDays(2),
                            "StartTime", java.sql.Time.valueOf("07:00:00"),
                            "EndTime", java.sql.Time.valueOf("08:30:00"))), 0));
                });
        when(jdbcTemplate.update(contains("UPDATE dbo.PTSessions SET Status = 'CANCELLED'"), eq("Cancelled by customer"),
                eq(222), eq(10))).thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute("customer-cancel-session", Map.of(
                "authorizationHeader", "Bearer customer",
                "sessionId", 222,
                "body", Map.of("cancelReason", "Cancelled by customer")));

        assertEquals("CANCELLED", result.get("status"));
        verify(notificationService, atLeastOnce()).notifyUser(eq(20), eq("PT_SESSION_CANCELLED_BY_CUSTOMER"),
                anyString(), contains("Customer Minh cancelled"), eq("/coach/schedule?tab=schedule"), eq(222),
                eq("PT_SESSION_CANCELLED_BY_CUSTOMER_222"));
    }

    @Test
    void coachCancelSession_shouldNotifyCustomer() {
        when(authService.requireAuthContext("Bearer coach"))
                .thenReturn(new AuthService.AuthContext(20, "COACH", "Coach Alex", "coach@gymcore.local"));

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessions s"),
                any(RowMapper.class),
                eq(333)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "PTSessionID", 333,
                            "CustomerID", 10,
                            "CoachID", 20,
                            "CustomerName", "Customer Minh",
                            "CoachName", "Coach Alex",
                            "SessionDate", LocalDate.now().plusDays(3),
                            "StartTime", java.sql.Time.valueOf("08:30:00"),
                            "EndTime", java.sql.Time.valueOf("10:00:00"))), 0));
                });
        when(jdbcTemplate.update(contains("SET Status = 'CANCELLED'"), eq("Cancelled by coach"), eq(333), eq(20)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute("coach-cancel-session", Map.of(
                "authorizationHeader", "Bearer coach",
                "sessionId", 333,
                "body", Map.of("cancelReason", "Cancelled by coach")));

        assertEquals("CANCELLED", result.get("status"));
        verify(notificationService, atLeastOnce()).notifyUser(eq(10), eq("PT_SESSION_CANCELLED_BY_COACH"),
                anyString(), contains("Coach Alex cancelled"), eq("/customer/coach-booking"), eq(333),
                eq("PT_SESSION_CANCELLED_BY_COACH_333"));
    }

    private Map<String, Object> mapOfNullable(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return map;
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
        when(rs.getDate(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value instanceof LocalDate localDate) {
                return java.sql.Date.valueOf(localDate);
            }
            return (java.sql.Date) value;
        });
        when(rs.getTime(anyString())).thenAnswer(invocation -> (java.sql.Time) values.get(invocation.getArgument(0)));
        when(rs.wasNull()).thenReturn(false);
        return rs;
    }
}
