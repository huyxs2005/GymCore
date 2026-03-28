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
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalTime;
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

        when(jdbcTemplate.query(contains("SELECT TOP (1)"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of());

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
    void customerCreateInstantBooking_shouldConfirmImmediatelyAndNotifyBothSides() {
        LocalDate requestStart = LocalDate.now().plusDays(1);
        LocalDate requestEnd = requestStart.plusDays(27);

        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.PTRecurringRequests"), any(RowMapper.class), eq(10)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(contains("UPPER(mp.PlanType) IN ('GYM_PLUS_COACH', 'GYM_COACH')"), any(RowMapper.class),
                eq(10), eq(requestStart), eq(requestStart)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = Mockito.mock(ResultSet.class);
                    when(rs.getInt("CustomerMembershipID")).thenReturn(77);
                    when(rs.getBoolean("AllowsCoachBooking")).thenReturn(true);
                    when(rs.getDate("EndDate")).thenReturn(java.sql.Date.valueOf(requestEnd));
                    return List.of(mapper.mapRow(rs, 0));
                });

        when(jdbcTemplate.query(eq("SELECT 1 FROM dbo.Coaches WHERE CoachID = ?"), any(RowMapper.class), eq(20)))
                .thenReturn(List.of(1));

        when(jdbcTemplate.query(contains("FROM dbo.CoachWeeklyAvailability"), any(RowMapper.class), eq(20)))
                .thenReturn(List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)));

        when(jdbcTemplate.query(
                contains("WHERE s.CoachID = ? AND s.SessionDate >= ? AND s.SessionDate <= ?"),
                any(RowMapper.class),
                eq(20),
                eq(requestStart),
                eq(requestEnd)))
                .thenReturn(List.of());

        when(jdbcTemplate.update(any(org.springframework.jdbc.core.PreparedStatementCreator.class), any(org.springframework.jdbc.support.KeyHolder.class)))
                .thenReturn(1);

        when(jdbcTemplate.query(
                contains("SELECT TOP (1) PTRequestID FROM dbo.PTRecurringRequests"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of(901));

        when(jdbcTemplate.update(contains("INSERT INTO dbo.PTRequestSlots"), eq(901), eq(1), eq(1))).thenReturn(1);
        when(jdbcTemplate.update(contains("INSERT INTO dbo.PTSessions"), eq(901), eq(10), eq(20), any(LocalDate.class), eq(1), eq(1)))
                .thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute("customer-create-instant-booking", Map.of(
                "authorizationHeader", "Bearer customer",
                "coachId", 20,
                "endDate", requestEnd.toString(),
                "slots", List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1))));

        assertEquals("APPROVED", result.get("status"));
        assertEquals("INSTANT", result.get("bookingMode"));
        assertEquals(901, result.get("ptRequestId"));
        assertTrue(((Integer) result.get("sessionsCreated")) > 0);
        verify(notificationService).notifyUser(eq(20), eq("PT_BOOKING_CONFIRMED"), anyString(), contains("booked a recurring PT phase"),
                eq("/coach/schedule?tab=schedule"), eq(901), eq("PT_BOOKING_CONFIRMED_901"));
        verify(notificationService).notifyUser(eq(10), eq("PT_BOOKING_CONFIRMED"), anyString(), contains("confirmed"),
                eq("/customer/coach-booking"), eq(901), eq("PT_BOOKING_CONFIRMED_CUSTOMER_901"));
    }

    @Test
    void adminUpdateCoachProfile_shouldRejectNegativeExperienceYears() {
        when(authService.requireAuthContext("Bearer admin"))
                .thenReturn(new AuthService.AuthContext(1, "ADMIN", "Admin GymCore", "admin@gymcore.local"));
        when(jdbcTemplate.queryForObject("SELECT COUNT(1) FROM dbo.Coaches WHERE CoachID = ?", Integer.class, 20))
                .thenReturn(1);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "admin-update-coach-profile",
                Map.of(
                        "authorizationHeader", "Bearer admin",
                        "coachId", 20,
                        "body", Map.of("experienceYears", -1))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("cannot be negative"));
    }

    @Test
    void adminUpdateCoachProfile_shouldRejectInvalidDateFormat() {
        when(authService.requireAuthContext("Bearer admin"))
                .thenReturn(new AuthService.AuthContext(1, "ADMIN", "Admin GymCore", "admin@gymcore.local"));
        when(jdbcTemplate.queryForObject("SELECT COUNT(1) FROM dbo.Coaches WHERE CoachID = ?", Integer.class, 20))
                .thenReturn(1);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "admin-update-coach-profile",
                Map.of(
                        "authorizationHeader", "Bearer admin",
                        "coachId", 20,
                        "body", Map.of("dateOfBirth", "03/07/2026"))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("YYYY-MM-DD"));
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
    void customerRescheduleSession_shouldConfirmDirectlyWhenSlotIsValid() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("JOIN dbo.PTRecurringRequests r ON r.PTRequestID = s.PTRequestID"),
                any(RowMapper.class),
                eq(222),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "coachId", 20,
                        "sessionDate", LocalDate.now().plusDays(3),
                        "timeSlotId", 1,
                        "status", "SCHEDULED",
                        "cancelReason", null,
                        "ptRequestId", 900,
                        "primaryCoachId", 20,
                        "endDate", LocalDate.now().plusDays(30))));

        when(jdbcTemplate.queryForObject(
                contains("SELECT TOP (1) StartTime"),
                eq(java.sql.Time.class),
                eq(1)))
                .thenReturn(java.sql.Time.valueOf(LocalTime.of(7, 0)));
        when(jdbcTemplate.queryForObject(
                contains("SELECT TOP (1) StartTime"),
                eq(java.sql.Time.class),
                eq(2)))
                .thenReturn(java.sql.Time.valueOf(LocalTime.of(8, 30)));

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

        when(jdbcTemplate.queryForObject(
                contains("AND PTSessionID <> ?"),
                eq(Integer.class),
                eq(20),
                eq(LocalDate.now().plusDays(3)),
                eq(2),
                eq(222)))
                .thenReturn(0);

        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.PTSessionReplacementOffers"),
                eq(Integer.class),
                eq(222)))
                .thenReturn(0);

        when(jdbcTemplate.update(contains("SET SessionDate = ?"), eq(LocalDate.now().plusDays(3)), eq(2),
                eq(LocalDate.now().plusDays(3).getDayOfWeek().getValue()), eq(222), eq(10))).thenReturn(1);
        when(jdbcTemplate.queryForObject("SELECT FullName FROM dbo.Users WHERE UserID = ?", String.class, 10))
                .thenReturn("Customer Minh");

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute("customer-reschedule-session", Map.of(
                "authorizationHeader", "Bearer customer",
                "sessionId", 222,
                "body", Map.of(
                        "sessionDate", LocalDate.now().plusDays(3).toString(),
                        "timeSlotId", 2,
                        "reason", "Need to move this session")));

        assertEquals("RESCHEDULED", result.get("status"));
        assertEquals(222, result.get("sessionId"));
        assertEquals(2, result.get("requestedTimeSlotId"));
        verify(jdbcTemplate).update(contains("SET SessionDate = ?"), eq(LocalDate.now().plusDays(3)), eq(2),
                eq(LocalDate.now().plusDays(3).getDayOfWeek().getValue()), eq(222), eq(10));
    }

    @Test
    void customerRescheduleSession_shouldRejectInsideTwelveHourCutoff() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("JOIN dbo.PTRecurringRequests r ON r.PTRequestID = s.PTRequestID"),
                any(RowMapper.class),
                eq(222),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "coachId", 20,
                        "sessionDate", LocalDate.now(),
                        "timeSlotId", 1,
                        "status", "SCHEDULED",
                        "cancelReason", null,
                        "ptRequestId", 900,
                        "primaryCoachId", 20,
                        "endDate", LocalDate.now().plusDays(30))));

        when(jdbcTemplate.queryForObject(
                contains("SELECT TOP (1) StartTime"),
                eq(java.sql.Time.class),
                eq(1)))
                .thenReturn(java.sql.Time.valueOf(LocalTime.now().plusHours(2).withSecond(0).withNano(0)));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.execute(
                "customer-reschedule-session",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "sessionId", 222,
                        "body", Map.of(
                                "sessionDate", LocalDate.now().plusDays(4).toString(),
                                "timeSlotId", 3))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("12 hours"));
    }

    @Test
    void customerRescheduleSession_shouldRejectWhenCoachNotAvailableForRequestedSlot() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("JOIN dbo.PTRecurringRequests r ON r.PTRequestID = s.PTRequestID"),
                any(RowMapper.class),
                eq(333),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "coachId", 20,
                        "sessionDate", LocalDate.now().plusDays(3),
                        "timeSlotId", 1,
                        "status", "SCHEDULED",
                        "cancelReason", null,
                        "ptRequestId", 901,
                        "primaryCoachId", 20,
                        "endDate", LocalDate.now().plusDays(30))));

        when(jdbcTemplate.queryForObject(
                contains("SELECT TOP (1) StartTime"),
                eq(java.sql.Time.class),
                eq(1)))
                .thenReturn(java.sql.Time.valueOf(LocalTime.of(7, 0)));
        when(jdbcTemplate.queryForObject(
                contains("SELECT TOP (1) StartTime"),
                eq(java.sql.Time.class),
                eq(2)))
                .thenReturn(java.sql.Time.valueOf(LocalTime.of(8, 30)));

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
    void customerRescheduleSeries_shouldReplaceFutureScheduledSessionsFromCutover() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("WHERE r.CustomerID = ?"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "ptRequestId", 900,
                        "customerId", 10,
                        "coachId", 20,
                        "coachName", "Coach Alex",
                        "coachEmail", "coach@gymcore.local",
                        "coachPhone", "0900000003",
                        "customerMembershipId", 77,
                        "startDate", "2026-03-17",
                        "endDate", LocalDate.now().plusDays(35).toString(),
                        "status", "APPROVED",
                        "bookingMode", "INSTANT")));

        when(jdbcTemplate.query(
                contains("FROM dbo.PTRequestSlots prs"),
                any(RowMapper.class),
                eq(900)))
                .thenReturn(List.of(Map.of("dayOfWeek", 1, "timeSlotId", 1)));

        when(jdbcTemplate.query(
                contains("Status <> 'SCHEDULED'"),
                any(RowMapper.class),
                eq(900),
                eq(LocalDate.now().plusDays(7))))
                .thenReturn(List.of());

        when(jdbcTemplate.queryForObject(contains("FROM dbo.CoachWeeklyAvailability"), eq(Integer.class), eq(20)))
                .thenReturn(56);
        when(jdbcTemplate.queryForObject(
                contains("WHERE CoachID = ? AND DayOfWeek = ? AND TimeSlotID = ? AND IsAvailable = 1"),
                eq(Integer.class), eq(20), eq(1), eq(2)))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(
                contains("WHERE PTRequestID = ? AND SessionDate = ? AND TimeSlotID = ?"),
                eq(Integer.class), eq(900), any(LocalDate.class), eq(2)))
                .thenReturn(0);
        when(jdbcTemplate.update(contains("DELETE FROM dbo.PTSessions"), eq(900), eq(LocalDate.now().plusDays(7))))
                .thenReturn(2);
        when(jdbcTemplate.update(contains("DELETE FROM dbo.PTRequestSlots"), eq(900))).thenReturn(1);
        when(jdbcTemplate.update(contains("INSERT INTO dbo.PTRequestSlots"), eq(900), eq(1), eq(2))).thenReturn(1);
        when(jdbcTemplate.queryForObject("SELECT FullName FROM dbo.Users WHERE UserID = ?", String.class, 10))
                .thenReturn("Customer Minh");

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "customer-reschedule-series",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "body", Map.of(
                                "cutoverDate", LocalDate.now().plusDays(7).toString(),
                                "slots", List.of(Map.of("dayOfWeek", 1, "timeSlotId", 2)))));

        assertEquals("UPDATED", result.get("status"));
        verify(jdbcTemplate).update(contains("DELETE FROM dbo.PTRequestSlots"), eq(900));
        verify(jdbcTemplate, atLeastOnce()).update(contains("INSERT INTO dbo.PTSessions"), eq(900), eq(10), eq(20),
                any(LocalDate.class), eq(1), eq(2));
    }

    @Test
    void extendApprovedPtCoverageIfNeeded_shouldExtendRequestAndGenerateNewSessions() {
        LocalDate currentEndDate = LocalDate.now().plusDays(6);
        LocalDate renewalStartDate = currentEndDate.plusDays(1);
        LocalDate renewalEndDate = renewalStartDate.plusDays(20);

        when(jdbcTemplate.query(
                contains("WHERE r.CustomerID = ?"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "ptRequestId", 900,
                        "customerId", 10,
                        "coachId", 20,
                        "coachName", "Coach Alex",
                        "coachEmail", "coach@gymcore.local",
                        "coachPhone", "0900000003",
                        "customerMembershipId", 77,
                        "startDate", LocalDate.now().minusDays(20).toString(),
                        "endDate", currentEndDate.toString(),
                        "status", "APPROVED",
                        "bookingMode", "INSTANT")));

        when(jdbcTemplate.query(
                contains("FROM dbo.PTRequestSlots prs"),
                any(RowMapper.class),
                eq(900)))
                .thenReturn(List.of(Map.of(
                        "dayOfWeek", renewalStartDate.getDayOfWeek().getValue(),
                        "timeSlotId", 1,
                        "slotIndex", 1,
                        "startTime", "07:00:00",
                        "endTime", "08:30:00")));

        when(jdbcTemplate.update(
                contains("UPDATE dbo.PTRecurringRequests"),
                eq(901),
                eq(renewalEndDate),
                eq(900),
                eq(10),
                eq(renewalEndDate)))
                .thenReturn(1);

        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.PTSessions"),
                eq(Integer.class),
                eq(900),
                any(LocalDate.class),
                eq(1)))
                .thenReturn(0);

        when(jdbcTemplate.update(
                contains("INSERT INTO dbo.PTSessions"),
                eq(900),
                eq(10),
                eq(20),
                any(LocalDate.class),
                eq(renewalStartDate.getDayOfWeek().getValue()),
                eq(1)))
                .thenReturn(1);

        service.extendApprovedPtCoverageIfNeeded(10, 901, renewalStartDate, renewalEndDate);

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.PTRecurringRequests"),
                eq(901),
                eq(renewalEndDate),
                eq(900),
                eq(10),
                eq(renewalEndDate));
        verify(jdbcTemplate, atLeastOnce()).update(
                contains("INSERT INTO dbo.PTSessions"),
                eq(900),
                eq(10),
                eq(20),
                any(LocalDate.class),
                eq(renewalStartDate.getDayOfWeek().getValue()),
                eq(1));
    }

    @Test
    void coachCreateUnavailableBlock_shouldPersistBlockAndCountImpactedSessions() {
        when(authService.requireAuthContext("Bearer coach"))
                .thenReturn(new AuthService.AuthContext(20, "COACH", "Coach Alex", "coach@gymcore.local"));

        when(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dbo.TimeSlots WHERE TimeSlotID = ?",
                Integer.class, 2))
                .thenReturn(1);
        when(jdbcTemplate.update(any(org.springframework.jdbc.core.PreparedStatementCreator.class),
                any(org.springframework.jdbc.support.KeyHolder.class)))
                .thenAnswer(invocation -> {
                    org.springframework.jdbc.support.KeyHolder keyHolder = invocation.getArgument(1);
                    keyHolder.getKeyList().add(Map.of("UnavailableBlockID", 61));
                    return 1;
                });
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.PTSessions"),
                eq(Integer.class),
                eq(20),
                eq(LocalDate.now().plusDays(1)),
                eq(LocalDate.now().plusDays(2)),
                eq(2),
                eq(2)))
                .thenReturn(2);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "coach-create-unavailable-block",
                Map.of(
                        "authorizationHeader", "Bearer coach",
                        "startDate", LocalDate.now().plusDays(1).toString(),
                        "endDate", LocalDate.now().plusDays(2).toString(),
                        "timeSlotId", 2,
                        "note", "Medical leave"));

        assertEquals(61, result.get("unavailableBlockId"));
        assertEquals(2, result.get("impactedSessions"));
    }

    @Test
    void customerRespondReplacementOffer_shouldAcceptAndSwapSessionCoach() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("WHERE o.PTSessionID = ?"),
                any(RowMapper.class),
                eq(777),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "offerId", 91,
                        "originalCoachId", 20,
                        "replacementCoachId", 21,
                        "sessionDate", LocalDate.now().plusDays(3),
                        "timeSlotId", 2)));
        when(jdbcTemplate.queryForObject(contains("FROM dbo.CoachWeeklyAvailability"), eq(Integer.class), eq(21)))
                .thenReturn(56);
        when(jdbcTemplate.queryForObject(
                contains("WHERE CoachID = ? AND DayOfWeek = ? AND TimeSlotID = ? AND IsAvailable = 1"),
                eq(Integer.class), eq(21), eq(LocalDate.now().plusDays(3).getDayOfWeek().getValue()), eq(2)))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(
                contains("AND PTSessionID <> ?"),
                eq(Integer.class), eq(21), eq(LocalDate.now().plusDays(3)), eq(2), eq(777)))
                .thenReturn(0);
        when(jdbcTemplate.update(contains("SET CoachID = ?"), eq(21), eq(777), eq(10))).thenReturn(1);
        when(jdbcTemplate.update(contains("UPDATE dbo.PTSessionReplacementOffers"), eq("ACCEPTED"), eq(91))).thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "customer-respond-replacement-offer",
                Map.of(
                        "authorizationHeader", "Bearer customer",
                        "sessionId", 777,
                        "body", Map.of("decision", "ACCEPT")));

        assertEquals("ACCEPTED", result.get("status"));
        verify(jdbcTemplate).update(contains("SET CoachID = ?"), eq(21), eq(777), eq(10));
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
    void customerGetCurrentPhase_shouldReturnDashboardForInstantPtPhase() throws Exception {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("COALESCE(r.BookingMode, 'REQUEST') AS BookingMode"),
                any(RowMapper.class),
                eq(10)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTRequestID", 900,
                            "CustomerID", 10,
                            "CoachID", 20,
                            "CustomerMembershipID", 77,
                            "StartDate", LocalDate.of(2026, 3, 17),
                            "EndDate", LocalDate.of(2026, 4, 14),
                            "Status", "APPROVED",
                            "BookingMode", "INSTANT",
                            "CoachName", "Coach Alex",
                            "CoachEmail", "coach@gymcore.local",
                            "CoachPhone", "0900000003")), 0));
                });

        when(jdbcTemplate.query(contains("FROM dbo.PTRequestSlots prs"), any(RowMapper.class), eq(900)))
                .thenReturn(List.of(
                        mapOfNullable("dayOfWeek", 1, "timeSlotId", 1, "slotIndex", 1,
                                "startTime", "07:00:00", "endTime", "08:30:00"),
                        mapOfNullable("dayOfWeek", 3, "timeSlotId", 1, "slotIndex", 1,
                                "startTime", "07:00:00", "endTime", "08:30:00")));

        when(jdbcTemplate.query(
                contains("AND s.Status = 'SCHEDULED'"),
                any(RowMapper.class),
                eq(900)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTSessionID", 301,
                            "PTRequestID", 900,
                            "CoachID", 20,
                            "CoachName", "Coach Alex",
                            "CoachPhone", "0900000003",
                            "SessionDate", LocalDate.of(2026, 3, 17),
                            "DayOfWeek", 1,
                            "TimeSlotID", 1,
                            "SlotIndex", 1,
                            "StartTime", java.sql.Time.valueOf("07:00:00"),
                            "EndTime", java.sql.Time.valueOf("08:30:00"),
                            "Status", "SCHEDULED",
                            "CancelReason", null)), 0));
                });

        when(jdbcTemplate.query(
                contains("AND s.SessionDate >= ?"),
                any(RowMapper.class),
                eq(900),
                any(LocalDate.class),
                any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTSessionID", 301,
                            "PTRequestID", 900,
                            "CoachID", 20,
                            "CoachName", "Coach Alex",
                            "CoachPhone", "0900000003",
                            "SessionDate", LocalDate.of(2026, 3, 17),
                            "DayOfWeek", 1,
                            "TimeSlotID", 1,
                            "SlotIndex", 1,
                            "StartTime", java.sql.Time.valueOf("07:00:00"),
                            "EndTime", java.sql.Time.valueOf("08:30:00"),
                            "Status", "SCHEDULED",
                            "CancelReason", null)), 0));
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessionNotes n"),
                any(RowMapper.class),
                eq(900)))
                .thenReturn(List.of(mapOfNullable(
                        "noteId", 88,
                        "ptSessionId", 301,
                        "noteContent", "Strong improvement in posture",
                        "createdAt", "2026-03-16T01:00:00Z",
                        "updatedAt", "2026-03-16T01:30:00Z")));

        when(jdbcTemplate.query(
                contains("FROM dbo.CustomerHealthHistory"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "heightCm", new BigDecimal("172.5"),
                        "weightKg", new BigDecimal("70.2"),
                        "bmi", new BigDecimal("23.6"),
                        "recordedAt", "2026-03-15T02:00:00Z")));

        when(jdbcTemplate.queryForObject(contains("WHERE PTRequestID = ? AND Status = 'COMPLETED'"), eq(Long.class), eq(900)))
                .thenReturn(2L);
        when(jdbcTemplate.queryForObject(contains("WHERE PTRequestID = ? AND Status = 'SCHEDULED'"), eq(Long.class), eq(900)))
                .thenReturn(4L);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "customer-get-current-phase",
                Map.of("authorizationHeader", "Bearer customer"));

        @SuppressWarnings("unchecked")
        Map<String, Object> activePhase = (Map<String, Object>) result.get("activePhase");
        @SuppressWarnings("unchecked")
        Map<String, Object> dashboard = (Map<String, Object>) result.get("dashboard");
        @SuppressWarnings("unchecked")
        Map<String, Object> nextSession = (Map<String, Object>) dashboard.get("nextSession");
        @SuppressWarnings("unchecked")
        Map<String, Object> latestSignals = (Map<String, Object>) dashboard.get("latestSignals");
        @SuppressWarnings("unchecked")
        Map<String, Object> mostRecentSignal = (Map<String, Object>) latestSignals.get("mostRecent");

        assertEquals("INSTANT", activePhase.get("bookingMode"));
        assertEquals("Coach Alex", activePhase.get("coachName"));
        assertEquals("Coach Alex", nextSession.get("coachName"));
        assertEquals(2L, dashboard.get("completedSessions"));
        assertEquals(4L, dashboard.get("remainingSessions"));
        assertFalse(((Map<?, ?>) dashboard.get("latestNote")).isEmpty());
        assertFalse(((Map<?, ?>) dashboard.get("latestProgress")).isEmpty());
        assertEquals("COACH_NOTE", mostRecentSignal.get("sourceType"));
    }

    @Test
    void customerGetProgressContext_shouldExposeCustomerSafePtSummary() throws Exception {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(
                contains("COALESCE(r.BookingMode, 'REQUEST') AS BookingMode"),
                any(RowMapper.class),
                eq(10)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTRequestID", 900,
                            "CustomerID", 10,
                            "CoachID", 20,
                            "CustomerMembershipID", 77,
                            "StartDate", LocalDate.of(2026, 3, 17),
                            "EndDate", LocalDate.of(2026, 4, 14),
                            "Status", "APPROVED",
                            "BookingMode", "INSTANT",
                            "CoachName", "Coach Alex",
                            "CoachEmail", "coach@gymcore.local",
                            "CoachPhone", "0900000003")), 0));
                });

        when(jdbcTemplate.query(contains("FROM dbo.PTRequestSlots prs"), any(RowMapper.class), eq(900)))
                .thenReturn(List.of(mapOfNullable(
                        "dayOfWeek", 1,
                        "timeSlotId", 1,
                        "slotIndex", 1,
                        "startTime", "07:00:00",
                        "endTime", "08:30:00")));

        when(jdbcTemplate.query(
                contains("AND s.Status = 'SCHEDULED'"),
                any(RowMapper.class),
                eq(900)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTSessionID", 301,
                            "PTRequestID", 900,
                            "CoachID", 20,
                            "CoachName", "Coach Alex",
                            "CoachPhone", "0900000003",
                            "SessionDate", LocalDate.of(2026, 3, 17),
                            "DayOfWeek", 1,
                            "TimeSlotID", 1,
                            "SlotIndex", 1,
                            "StartTime", java.sql.Time.valueOf("07:00:00"),
                            "EndTime", java.sql.Time.valueOf("08:30:00"),
                            "Status", "SCHEDULED",
                            "CancelReason", null)), 0));
                });

        when(jdbcTemplate.query(
                contains("AND s.SessionDate >= ?"),
                any(RowMapper.class),
                eq(900),
                any(LocalDate.class),
                any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTSessionID", 301,
                            "PTRequestID", 900,
                            "CoachID", 20,
                            "CoachName", "Coach Alex",
                            "CoachPhone", "0900000003",
                            "SessionDate", LocalDate.of(2026, 3, 17),
                            "DayOfWeek", 1,
                            "TimeSlotID", 1,
                            "SlotIndex", 1,
                            "StartTime", java.sql.Time.valueOf("07:00:00"),
                            "EndTime", java.sql.Time.valueOf("08:30:00"),
                            "Status", "SCHEDULED",
                            "CancelReason", null)), 0));
                });

        when(jdbcTemplate.query(
                contains("SELECT TOP (3)"),
                any(RowMapper.class),
                eq(900)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(mapOfNullable(
                            "PTSessionID", 205,
                            "PTRequestID", 900,
                            "CoachID", 20,
                            "CoachName", "Coach Alex",
                            "CoachPhone", "0900000003",
                            "SessionDate", LocalDate.of(2026, 3, 10),
                            "DayOfWeek", 2,
                            "TimeSlotID", 1,
                            "SlotIndex", 1,
                            "StartTime", java.sql.Time.valueOf("07:00:00"),
                            "EndTime", java.sql.Time.valueOf("08:30:00"),
                            "Status", "COMPLETED",
                            "CancelReason", null,
                            "NoteCount", 1)), 0));
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.PTSessionNotes n"),
                any(RowMapper.class),
                eq(900)))
                .thenReturn(List.of(mapOfNullable(
                        "noteId", 88,
                        "ptSessionId", 301,
                        "noteContent", "Strong improvement in posture",
                        "createdAt", "2026-03-16T01:00:00Z",
                        "updatedAt", "2026-03-16T01:30:00Z")));

        when(jdbcTemplate.query(
                contains("FROM dbo.CustomerHealthHistory"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of(mapOfNullable(
                        "heightCm", new BigDecimal("172.5"),
                        "weightKg", new BigDecimal("70.2"),
                        "bmi", new BigDecimal("23.6"),
                        "recordedAt", "2026-03-15T02:00:00Z")));

        when(jdbcTemplate.queryForObject(contains("WHERE PTRequestID = ? AND Status = 'COMPLETED'"), eq(Long.class), eq(900)))
                .thenReturn(2L);
        when(jdbcTemplate.queryForObject(contains("WHERE PTRequestID = ? AND Status = 'SCHEDULED'"), eq(Long.class), eq(900)))
                .thenReturn(4L);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "customer-get-progress-context",
                Map.of("authorizationHeader", "Bearer customer"));

        assertEquals(Boolean.TRUE, result.get("hasActivePt"));
        assertEquals("ACTIVE_PHASE", result.get("status"));
        assertEquals("APPROVED", result.get("currentPtStatus"));
        assertEquals("INSTANT", result.get("bookingMode"));

        @SuppressWarnings("unchecked")
        Map<String, Object> coach = (Map<String, Object>) result.get("coach");
        assertEquals("Coach Alex", coach.get("coachName"));

        @SuppressWarnings("unchecked")
        Map<String, Object> nextSession = (Map<String, Object>) result.get("nextSession");
        assertEquals("Coach Alex", nextSession.get("coachName"));
        @SuppressWarnings("unchecked")
        Map<String, Object> latestNoteSignal = (Map<String, Object>) result.get("latestNoteSignal");
        @SuppressWarnings("unchecked")
        Map<String, Object> latestProgressSignal = (Map<String, Object>) result.get("latestProgressSignal");
        @SuppressWarnings("unchecked")
        Map<String, Object> latestSignals = (Map<String, Object>) result.get("latestSignals");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> recentSessions = (List<Map<String, Object>>) result.get("recentSessions");
        assertEquals(1, recentSessions.size());
        assertEquals("COACH_NOTE", latestNoteSignal.get("sourceType"));
        assertEquals("HEALTH_SNAPSHOT", latestProgressSignal.get("sourceType"));
        assertEquals("COACH_NOTE", ((Map<?, ?>) latestSignals.get("mostRecent")).get("sourceType"));
        assertEquals(2L, result.get("completedSessions"));
        assertEquals(4L, result.get("remainingSessions"));
    }

    @Test
    void customerGetProgressContext_shouldReturnExplicitEmptyStateWithoutActivePt() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));
        when(jdbcTemplate.query(
                contains("COALESCE(r.BookingMode, 'REQUEST') AS BookingMode"),
                any(RowMapper.class),
                eq(10)))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) service.execute(
                "customer-get-progress-context",
                Map.of("authorizationHeader", "Bearer customer"));

        assertEquals(Boolean.FALSE, result.get("hasActivePt"));
        assertEquals("NO_ACTIVE_PHASE", result.get("status"));
        assertEquals("NONE", result.get("currentPtStatus"));
        assertEquals(Map.of(), result.get("nextSession"));
        assertEquals(List.of(), result.get("recentSessions"));
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

        when(jdbcTemplate.query(contains("UPPER(mp.PlanType) IN ('GYM_PLUS_COACH', 'GYM_COACH')"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = Mockito.mock(ResultSet.class);
                    when(rs.getInt("CustomerMembershipID")).thenReturn(77);
                    when(rs.getBoolean("AllowsCoachBooking")).thenReturn(true);
                    when(rs.getDate("EndDate")).thenReturn(java.sql.Date.valueOf(LocalDate.now().plusDays(28)));
                    return List.of(mapper.mapRow(rs, 0));
                });

        when(jdbcTemplate.query(contains("FROM dbo.Coaches"), any(RowMapper.class)))
                .thenReturn(List.of(
                        mapOfNullable("coachId", 501, "fullName", "Coach Full", "email", "full@gymcore.local",
                                "phone", "1", "avatarUrl", null, "experienceYears", 3, "bio", "full",
                                "averageRating", 5.0, "reviewCount", 10, "acceptingCustomers", true),
                        mapOfNullable("coachId", 502, "fullName", "Coach Partial", "email", "partial@gymcore.local",
                                "phone", "2", "avatarUrl", null, "experienceYears", 2, "bio", "partial",
                                "averageRating", 4.5, "reviewCount", 7, "acceptingCustomers", true)));

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
        verify(jdbcTemplate).query(contains("UPPER(mp.PlanType) IN ('GYM_PLUS_COACH', 'GYM_COACH')"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    void customerMatchCoaches_shouldRejectWhenNoActiveGymCoachMembership() {
        when(authService.requireAuthContext("Bearer customer"))
                .thenReturn(new AuthService.AuthContext(10, "CUSTOMER", "Customer Minh", "customer@gymcore.local"));

        when(jdbcTemplate.query(contains("FROM dbo.PTRecurringRequests"), any(RowMapper.class), eq(10)))
                .thenReturn(List.of());

        when(jdbcTemplate.query(contains("SELECT TOP (1)"), any(RowMapper.class),
                eq(10), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of());

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
                anyString(),
                any(RowMapper.class),
                eq(77),
                eq(10),
                eq(expectedStartDate),
                eq(endDate)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = Mockito.mock(ResultSet.class);
                    when(rs.getInt("CustomerMembershipID")).thenReturn(77);
                    when(rs.getBoolean("AllowsCoachBooking")).thenReturn(true);
                    when(rs.getDate("EndDate")).thenReturn(java.sql.Date.valueOf(endDate));
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
        verify(jdbcTemplate).query(anyString(), any(RowMapper.class),
                eq(77), eq(10), eq(expectedStartDate), eq(endDate));
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
        when(rs.getTimestamp(anyString())).thenAnswer(invocation -> (Timestamp) values.get(invocation.getArgument(0)));
        when(rs.getBigDecimal(anyString())).thenAnswer(invocation -> (BigDecimal) values.get(invocation.getArgument(0)));
        when(rs.getObject(anyString())).thenAnswer(invocation -> values.get(invocation.getArgument(0)));
        when(rs.getBoolean(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value instanceof Boolean bool && bool;
        });
        when(rs.wasNull()).thenReturn(false);
        return rs;
    }

    private LocalDate nextMonday(LocalDate date) {
        int daysUntilMonday = Math.floorMod(8 - date.getDayOfWeek().getValue(), 7);
        return date.plusDays(daysUntilMonday);
    }
}
