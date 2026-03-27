package com.gymcore.backend.modules.coach.service;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.auth.service.AuthService;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CoachBookingService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final int SELF_SERVICE_RESCHEDULE_CUTOFF_HOURS = 12;
    private static final String RESCHEDULE_REQUEST_PREFIX = "RESCHEDULE_REQUEST|";
    private static final String RESCHEDULE_DENIED_PREFIX = "RESCHEDULE_DENIED|";
    private static final String COACH_MATCH_OPT_OUT_TOKEN = "[[PT_MATCH_DISABLED]]";

    private final JdbcTemplate jdbcTemplate;
    private final AuthService authService;
    private final UserNotificationService notificationService;

    public CoachBookingService(JdbcTemplate jdbcTemplate, AuthService authService,
            UserNotificationService notificationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.authService = authService;
        this.notificationService = notificationService;
    }

    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> request = asMap(payload);
        return switch (action) {
            case "get-time-slots" -> getTimeSlots();
            case "customer-get-coaches" -> customerGetCoaches(request);
            case "customer-get-coach-detail" -> customerGetCoachDetail(request);
            case "customer-get-coach-schedule" -> customerGetCoachSchedule(request);
            case "customer-match-coaches" -> customerMatchCoaches(request);
            case "customer-create-booking-request" -> customerCreateBookingRequest(request);
            case "customer-create-instant-booking" -> customerCreateInstantBooking(request);
            case "customer-get-my-schedule" -> customerGetMySchedule(request);
            case "customer-get-current-phase" -> customerGetCurrentPhase(request);
            case "customer-get-progress-context" -> customerGetProgressContext(request);
            case "customer-cancel-booking-request" -> customerCancelBookingRequest(request);
            case "customer-delete-session" -> customerDeleteSession(request);
            case "coach-get-pt-requests" -> coachGetPtRequests(request);
            case "coach-approve-pt-request" -> coachApprovePtRequest(request);
            case "coach-deny-pt-request" -> coachDenyPtRequest(request);
            case "customer-cancel-session" -> customerCancelSession(request);
            case "customer-reschedule-session" -> customerRescheduleSession(request);
            case "customer-reschedule-series" -> customerRescheduleSeries(request);
            case "customer-respond-replacement-offer" -> customerRespondReplacementOffer(request);
            case "customer-submit-feedback" -> customerSubmitFeedback(request);
            case "coach-update-availability" -> coachUpdateAvailability(request);
            case "coach-get-availability" -> coachGetMyAvailability(request);
            case "coach-get-schedule" -> coachGetSchedule(request);
            case "coach-get-pt-sessions" -> coachGetPtSessions(request);
            case "coach-get-unavailable-blocks" -> coachGetUnavailableBlocks(request);
            case "coach-create-unavailable-block" -> coachCreateUnavailableBlock(request);
            case "coach-get-exception-sessions" -> coachGetExceptionSessions(request);
            case "coach-create-replacement-offer" -> coachCreateReplacementOffer(request);
            case "coach-get-replacement-coaches" -> coachGetReplacementCoaches(request);
            case "coach-create-session-notes" -> coachCreateSessionNotes(request);
            case "coach-update-session-note" -> coachUpdateSessionNote(request);
            case "coach-get-customers" -> coachGetCustomers(request);
            case "coach-get-customer-detail" -> coachGetCustomerDetail(request);
            case "coach-get-customer-history" -> coachGetCustomerHistory(request);
            case "coach-update-customer-progress" -> coachUpdateCustomerProgress(request);
            case "coach-cancel-session" -> coachCancelSession(request);
            case "coach-delete-session" -> coachDeleteSession(request);
            case "coach-complete-session" -> coachCompleteSession(request);
            case "coach-get-feedback" -> coachGetFeedback(request);
            case "coach-get-feedback-average" -> coachGetFeedbackAverage(request);
            case "coach-get-reschedule-requests" -> coachGetRescheduleRequests(request);
            case "coach-approve-reschedule-request" -> coachApproveRescheduleRequest(request);
            case "coach-deny-reschedule-request" -> coachDenyRescheduleRequest(request);
            case "admin-get-coaches" -> adminGetCoaches(request);
            case "admin-get-coach-detail" -> adminGetCoachDetail(request);
            case "admin-update-coach-profile" -> adminUpdateCoachProfile(request);
            case "admin-get-coach-performance" -> adminGetCoachPerformance(request);
            case "admin-get-coach-students" -> adminGetCoachStudents(request);
            default -> throw unsupportedAction(action);
        };
    }

    public Map<String, Object> previewCustomerCoachMatches(Map<String, Object> payload) {
        return customerMatchCoaches(payload);
    }

    // ---------- Common ----------

    private Map<String, Object> getTimeSlots() {
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TimeSlotID, SlotIndex, StartTime, EndTime
                FROM dbo.TimeSlots
                ORDER BY SlotIndex
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            m.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            m.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            return m;
        });
        return Map.of("items", items);
    }

    // ---------- Customer ----------

    private Map<String, Object> customerDeleteSession(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireAuth(payload);
        int sessionId = requireInteger(payload, "sessionId");

        // Verify session belongs to customer and is CANCELLED
        List<String> status = jdbcTemplate.query(
                "SELECT Status FROM dbo.PTSessions WHERE PTSessionID = ? AND CustomerID = ?",
                (rs, i) -> rs.getString("Status"), sessionId, customer.userId());

        if (status.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found.");
        }

        if (!"CANCELLED".equalsIgnoreCase(status.get(0))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only cancelled sessions can be deleted.");
        }

        jdbcTemplate.update("DELETE FROM dbo.PTSessionNotes WHERE PTSessionID = ?", sessionId);
        jdbcTemplate.update("DELETE FROM dbo.PTSessions WHERE PTSessionID = ?", sessionId);

        return Map.of("sessionId", sessionId, "message", "Session deleted successfully.");
    }

    private Map<String, Object> customerGetCoaches(Map<String, Object> payload) {
        requireCustomer(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT
                    ch.CoachID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.AvatarUrl,
                    ch.ExperienceYears,
                    ch.Bio,
                    COALESCE(agg.AvgRating, 0) AS AvgRating,
                    COALESCE(agg.ReviewCount, 0) AS ReviewCount
                FROM dbo.Coaches ch
                JOIN dbo.Users u ON u.UserID = ch.CoachID
                LEFT JOIN (
                    SELECT CoachID, AVG(CAST(Rating AS FLOAT)) AS AvgRating, COUNT(*) AS ReviewCount
                    FROM dbo.CoachFeedback GROUP BY CoachID
                ) agg ON agg.CoachID = ch.CoachID
                WHERE u.IsActive = 1
                ORDER BY AvgRating DESC, u.FullName
                """, coachListRowMapper()).stream()
                .filter(item -> Boolean.TRUE.equals(item.get("acceptingCustomers")))
                .toList();
        return Map.of("items", items);
    }

    private Map<String, Object> customerGetCoachDetail(Map<String, Object> payload) {
        requireCustomer(payload);
        int coachId = requireInteger(payload, "coachId");
        Map<String, Object> coach = jdbcTemplate.query("""
                SELECT
                    c.CoachID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.AvatarUrl,
                    c.DateOfBirth,
                    c.Gender,
                    c.ExperienceYears,
                    c.Bio,
                    COALESCE(agg.AvgRating, 0) AS AvgRating,
                    COALESCE(agg.ReviewCount, 0) AS ReviewCount
                FROM dbo.Coaches c
                JOIN dbo.Users u ON u.UserID = c.CoachID
                LEFT JOIN (
                    SELECT CoachID, AVG(CAST(Rating AS FLOAT)) AS AvgRating, COUNT(*) AS ReviewCount
                    FROM dbo.CoachFeedback GROUP BY CoachID
                ) agg ON agg.CoachID = c.CoachID
                WHERE c.CoachID = ?
                """, coachDetailRowMapper(), coachId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found."));

        List<Map<String, Object>> availability = loadWeeklyAvailability(coachId);

        List<Map<String, Object>> recentFeedback = jdbcTemplate.query("""
                SELECT cf.Rating, cf.Comment, cf.CreatedAt, u.FullName AS CustomerName
                FROM dbo.CoachFeedback cf
                JOIN dbo.Users u ON u.UserID = cf.CustomerID
                WHERE cf.CoachID = ? ORDER BY cf.CreatedAt DESC
                """, feedbackRowMapper(), coachId);

        coach.put("availability", availability);
        coach.put("recentFeedback", recentFeedback);
        return coach;
    }

    private Map<String, Object> customerGetCoachSchedule(Map<String, Object> payload) {
        requireCustomer(payload);
        int coachId = requireInteger(payload, "coachId");
        String fromStr = asText(payload.get("fromDate"));
        String toStr = asText(payload.get("toDate"));
        LocalDate from = fromStr != null ? LocalDate.parse(fromStr) : LocalDate.now();
        LocalDate to = toStr != null ? LocalDate.parse(toStr) : from.plusDays(13);

        List<Map<String, Object>> weeklyAvailability = loadWeeklyAvailability(coachId);

        List<Map<String, Object>> booked = jdbcTemplate.query(
                """
                        SELECT s.SessionDate, s.DayOfWeek, s.TimeSlotID, ts.SlotIndex, ts.StartTime, ts.EndTime, s.Status, s.CancelReason
                        FROM dbo.PTSessions s
                        JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                        WHERE s.CoachID = ? AND s.SessionDate >= ? AND s.SessionDate <= ? AND s.Status IN ('SCHEDULED','COMPLETED')
                        ORDER BY s.SessionDate, ts.SlotIndex
                        """,
                sessionSlotRowMapper(), coachId, from, to);

        List<Map<String, Object>> availableSlots = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            int dayOfWeek = d.getDayOfWeek().getValue();
            String dateStr = dateToString(d);
            for (Map<String, Object> av : weeklyAvailability) {
                if (parseInteger(av.get("dayOfWeek")) == dayOfWeek) {
                    Object timeSlotId = av.get("timeSlotId");
                    boolean taken = booked.stream().anyMatch(
                            b -> dateStr.equals(b.get("sessionDate")) && timeSlotId.equals(b.get("timeSlotId")));
                    if (!taken) {
                        Map<String, Object> slot = new LinkedHashMap<>(av);
                        slot.put("date", dateStr);
                        slot.put("available", true);
                        availableSlots.add(slot);
                    }
                }
            }
        }

        return Map.of(
                "weeklyAvailability", weeklyAvailability,
                "bookedSlots", booked,
                "availableSlots", availableSlots,
                "fromDate", dateToString(from),
                "toDate", dateToString(to));
    }

    private Map<String, Object> customerMatchCoaches(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        ensureNoBlockingPtRequest(customer.userId());
        LocalDate startDate = LocalDate.now();
        MembershipForPt membership = findActiveMembershipForPt(customer.userId(), startDate);
        if (membership.customerMembershipId() == null || !membership.allowsCoachBooking()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You need an ACTIVE Gym + Coach membership covering the selected period.");
        }
        LocalDate endDate = membership.coverageEndDate();
        if (endDate == null || endDate.isBefore(startDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You need an ACTIVE Gym + Coach membership covering the selected period.");
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> slots = (List<Map<String, Object>>) payload.get("slots");
        if (slots == null || slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "At least one slot (dayOfWeek, timeSlotId) is required.");
        }

        List<RequestedSlot> requestedSlots = normalizeRequestedSlots(slots);
        List<Map<String, Object>> coaches = asList(customerGetCoaches(payload).get("items"));

        List<Map<String, Object>> fullMatches = new ArrayList<>();
        List<Map<String, Object>> partialMatches = new ArrayList<>();

        for (Map<String, Object> coach : coaches) {
            int coachId = requireInteger(coach, "coachId");
            MatchSummary summary = evaluateCoachMatch(coachId, startDate, endDate, requestedSlots);
            boolean fullMatch = summary.exactMatchedSlots() == requestedSlots.size();
            boolean partialMatch = !fullMatch
                    && (summary.matchedSlots() > 0 || summary.bookedConflictSlots() > 0);

            Map<String, Object> item = new LinkedHashMap<>(coach);
            item.put("matchType", fullMatch ? "FULL" : "PARTIAL");
            item.put("matchedSlots", summary.matchedSlots());
            item.put("exactMatchedSlots", summary.exactMatchedSlots());
            item.put("bookedConflictSlots", summary.bookedConflictSlots());
            item.put("requestedSlots", requestedSlots.size());
            item.put("unavailableSlots", summary.unavailableSlots());
            item.put("alternativeSlots", summary.alternativeSlots());
            item.put("resolvedSlots", summary.resolvedSlots());

            if (fullMatch) {
                fullMatches.add(item);
            } else if (partialMatch) {
                partialMatches.add(item);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fullMatches", fullMatches);
        result.put("partialMatches", partialMatches);
        result.put("requestedSlotsCount", requestedSlots.size());
        result.put("estimatedStartDate", dateToString(startDate));
        result.put("fromDate", dateToString(startDate));
        result.put("toDate", dateToString(endDate));
        List<Map<String, Object>> items = new ArrayList<>();
        items.addAll(fullMatches);
        items.addAll(partialMatches);
        result.put("items", items);
        return result;
    }

    @Transactional
    private Map<String, Object> customerCreateBookingRequest(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        ensureNoBlockingPtRequest(customer.userId());
        int coachId = requireInteger(payload, "coachId");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> slots = (List<Map<String, Object>>) payload.get("slots");
        if (slots == null || slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "At least one slot (dayOfWeek, timeSlotId) is required.");
        }

        LocalDate startDate = resolveMinimumBookingStartDate(LocalDate.now());
        MembershipForPt membership = findActiveMembershipForPt(customer.userId(), startDate);
        Integer customerMembershipId = membership.customerMembershipId();
        LocalDate endDate = membership.coverageEndDate();
        if (customerMembershipId == null || !membership.allowsCoachBooking() || endDate == null || endDate.isBefore(startDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You need an ACTIVE Gym + Coach membership covering the selected period.");
        }
        requireCoachExists(coachId);
        List<RequestedSlot> requestedSlots = normalizeRequestedSlots(slots);
        List<Map<String, Object>> normalizedSlots = toRequestedSlotMaps(requestedSlots);

        int ptRequestId = insertPtRecurringRequest(customer.userId(), coachId, customerMembershipId, startDate, endDate,
                "PENDING", "REQUEST");
        insertPtRequestSlots(ptRequestId, normalizedSlots);

        notifyPtRequestCreated(ptRequestId, customer.userId(), coachId, startDate, endDate);

        // In PENDING flow, we do NOT generate sessions until coach approves
        return Map.of(
                "ptRequestId", ptRequestId,
                "startDate", dateToString(startDate),
                "endDate", dateToString(endDate),
                "status", "PENDING",
                "message", "Booking request sent successfully. Please wait for coach approval.");
    }

    @Transactional
    private Map<String, Object> customerCreateInstantBooking(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        ensureNoBlockingPtRequest(customer.userId());
        int coachId = requireInteger(payload, "coachId");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> slots = (List<Map<String, Object>>) payload.get("slots");
        if (slots == null || slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "At least one slot (dayOfWeek, timeSlotId) is required.");
        }

        LocalDate startDate = resolveMinimumBookingStartDate(LocalDate.now());
        MembershipForPt membership = findActiveMembershipForPt(customer.userId(), startDate);
        Integer customerMembershipId = membership.customerMembershipId();
        LocalDate endDate = membership.coverageEndDate();
        if (customerMembershipId == null || !membership.allowsCoachBooking() || endDate == null || endDate.isBefore(startDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You need an ACTIVE Gym + Coach membership covering the selected period.");
        }
        requireCoachExists(coachId);

        List<RequestedSlot> requestedSlots = normalizeRequestedSlots(slots);
        List<Map<String, Object>> normalizedSlots = toRequestedSlotMaps(requestedSlots);
        MatchSummary summary = evaluateCoachMatch(coachId, startDate, endDate, requestedSlots);
        if (summary.exactMatchedSlots() != requestedSlots.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Selected coach does not have all requested recurring slots available for instant booking.");
        }

        int ptRequestId = insertPtRecurringRequest(customer.userId(), coachId, customerMembershipId, startDate, endDate,
                "APPROVED", "INSTANT");
        insertPtRequestSlots(ptRequestId, normalizedSlots);
        int sessionsCreated = generatePTSessions(ptRequestId, customer.userId(), coachId, startDate, endDate, normalizedSlots);

        notifyInstantPtBookingCreated(ptRequestId, customer.userId(), coachId, startDate, endDate);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ptRequestId", ptRequestId);
        response.put("status", "APPROVED");
        response.put("bookingMode", "INSTANT");
        response.put("startDate", dateToString(startDate));
        response.put("endDate", dateToString(endDate));
        response.put("sessionsCreated", sessionsCreated);
        response.put("message", "PT booking confirmed successfully.");
        return response;
    }

    private int insertPtRecurringRequest(
            int customerId,
            int coachId,
            int customerMembershipId,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            String bookingMode) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        try {
            jdbcTemplate.update(con -> {
                var ps = con.prepareStatement(
                        """
                                INSERT INTO dbo.PTRecurringRequests (
                                    CustomerID,
                                    CoachID,
                                    CustomerMembershipID,
                                    StartDate,
                                    EndDate,
                                    Status,
                                    BookingMode
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                                """,
                        java.sql.Statement.RETURN_GENERATED_KEYS);
                ps.setInt(1, customerId);
                ps.setInt(2, coachId);
                ps.setInt(3, customerMembershipId);
                ps.setObject(4, startDate);
                ps.setObject(5, endDate);
                ps.setString(6, status);
                ps.setString(7, bookingMode);
                return ps;
            }, keyHolder);
        } catch (DataAccessException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid membership or dates. Membership must be ACTIVE and allow coach booking.");
        }
        Number key = keyHolder.getKey();
        int ptRequestId = key != null ? key.intValue() : 0;
        if (ptRequestId == 0) {
            List<Integer> ids = jdbcTemplate.query(
                    "SELECT TOP (1) PTRequestID FROM dbo.PTRecurringRequests WHERE CustomerID = ? ORDER BY PTRequestID DESC",
                    (rs, i) -> rs.getInt("PTRequestID"), customerId);
            ptRequestId = ids.isEmpty() ? 0 : ids.getFirst();
        }
        if (ptRequestId == 0) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create PT phase.");
        }
        return ptRequestId;
    }

    private void insertPtRequestSlots(int ptRequestId, List<Map<String, Object>> slots) {
        for (Map<String, Object> slot : slots) {
            int dayOfWeek = requireInteger(slot, "dayOfWeek");
            int timeSlotId = requireInteger(slot, "timeSlotId");
            if (dayOfWeek < 1 || dayOfWeek > 7) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dayOfWeek must be 1-7.");
            }
            jdbcTemplate.update("INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID) VALUES (?, ?, ?)",
                    ptRequestId, dayOfWeek, timeSlotId);
        }
    }

    private void ensureNoBlockingPtRequest(int customerId) {
        ExistingPtBooking existing = findBlockingPtRequest(customerId);
        if (existing == null) {
            return;
        }
        if ("PENDING".equals(existing.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You already have a PT request pending coach approval. Please wait for the coach response before booking again.");
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "You already have an active PT schedule. You cannot book another coach until your current PT arrangement ends.");
    }

    private ExistingPtBooking findBlockingPtRequest(int customerId) {
        List<ExistingPtBooking> items = jdbcTemplate.query("""
                SELECT TOP (1)
                    Status,
                    StartDate,
                    EndDate,
                    CoachID
                FROM dbo.PTRecurringRequests
                WHERE CustomerID = ?
                  AND (
                        Status = 'PENDING'
                        OR (Status = 'APPROVED' AND EndDate >= CAST(GETDATE() AS DATE))
                  )
                ORDER BY
                    CASE WHEN Status = 'PENDING' THEN 1 ELSE 2 END,
                    EndDate DESC,
                    PTRequestID DESC
                """, (rs, i) -> new ExistingPtBooking(
                rs.getString("Status"),
                rs.getDate("StartDate") != null ? rs.getDate("StartDate").toLocalDate() : null,
                rs.getDate("EndDate") != null ? rs.getDate("EndDate").toLocalDate() : null,
                rs.getInt("CoachID")), customerId);
        return items.isEmpty() ? null : items.getFirst();
    }

    private int generatePTSessions(int ptRequestId, int customerId, int coachId, LocalDate startDate, LocalDate endDate,
            List<Map<String, Object>> slots) {
        int count = 0;
        for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
            int dayOfWeek = d.getDayOfWeek().getValue();
            for (Map<String, Object> slot : slots) {
                if (parseInteger(slot.get("dayOfWeek")) == dayOfWeek) {
                    int timeSlotId = parseInteger(slot.get("timeSlotId"));
                    if (createScheduledSessionIfMissing(ptRequestId, customerId, coachId, d, dayOfWeek, timeSlotId)) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    private Map<String, Object> customerGetCurrentPhase(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        return buildCurrentPhaseResponse(customer.userId());
    }

    private Map<String, Object> customerGetProgressContext(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        return buildCustomerProgressContext(customer.userId());
    }

    @Transactional
    private Map<String, Object> customerCancelBookingRequest(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        int requestId = requireInteger(payload, "requestId");

        Map<String, Object> request = jdbcTemplate.query("""
                SELECT TOP (1)
                    r.PTRequestID,
                    r.CoachID,
                    r.Status,
                    r.CreatedAt,
                    u.FullName AS CoachName
                FROM dbo.PTRecurringRequests r
                JOIN dbo.Users u ON u.UserID = r.CoachID
                WHERE r.PTRequestID = ?
                  AND r.CustomerID = ?
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ptRequestId", rs.getInt("PTRequestID"));
            item.put("coachId", rs.getInt("CoachID"));
            item.put("coachName", rs.getString("CoachName"));
            item.put("status", rs.getString("Status"));
            item.put("createdAt", rs.getTimestamp("CreatedAt"));
            return item;
        }, requestId, customer.userId()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PT request not found."));

        String status = asText(request.get("status")).toUpperCase();
        if (!"PENDING".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only pending PT requests can be cancelled.");
        }

        Timestamp createdAt = (Timestamp) request.get("createdAt");
        if (createdAt == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Request creation time is missing.");
        }

        LocalDateTime cancelDeadline = createdAt.toLocalDateTime().plusMinutes(5);
        if (LocalDateTime.now().isAfter(cancelDeadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This PT request can only be cancelled within 5 minutes after booking.");
        }

        jdbcTemplate.update("DELETE FROM dbo.PTRequestSlots WHERE PTRequestID = ?", requestId);
        jdbcTemplate.update(
                "DELETE FROM dbo.PTRecurringRequests WHERE PTRequestID = ? AND CustomerID = ? AND Status = 'PENDING'",
                requestId, customer.userId());

        Integer coachId = (Integer) request.get("coachId");
        if (coachId != null) {
            String customerName = loadUserFullName(customer.userId());
            notificationService.notifyUser(
                    coachId,
                    "PT_REQUEST_CANCELLED_BY_CUSTOMER",
                    "PT booking request cancelled",
                    customerName + " cancelled the PT booking request before coach approval.",
                    "/coach/booking-requests",
                    requestId,
                    "PT_REQUEST_CANCELLED_BY_CUSTOMER_" + requestId);
        }

        notificationService.notifyUser(
                customer.userId(),
                "PT_REQUEST_CANCELLED",
                "PT booking request cancelled",
                "Your PT booking request was cancelled successfully.",
                "/customer/coach-booking",
                requestId,
                "PT_REQUEST_CANCELLED_" + requestId);

        return Map.of(
                "ptRequestId", requestId,
                "status", "CANCELLED",
                "message", "PT booking request cancelled successfully.");
    }

    public Map<String, Object> getCustomerProgressContext(int customerId) {
        return buildCustomerProgressContext(customerId);
    }

    private Map<String, Object> buildCurrentPhaseResponse(int customerId) {
        Map<String, Object> activePhase = loadActivePtPhase(customerId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("activePhase", activePhase);
        response.put("dashboard", activePhase == null ? Map.of() : buildPtDashboard(activePhase));
        return response;
    }

    private Map<String, Object> buildCustomerProgressContext(int customerId) {
        Map<String, Object> activePhase = loadActivePtPhase(customerId);
        if (activePhase == null) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("hasActivePt", false);
            empty.put("status", "NO_ACTIVE_PHASE");
            empty.put("currentPtStatus", "NONE");
            empty.put("activePhase", Map.of());
            empty.put("coach", Map.of());
            empty.put("nextSession", Map.of());
            empty.put("recentSessions", List.of());
            empty.put("weeklySchedule", List.of());
            empty.put("templateSlots", List.of());
            empty.put("completedSessions", 0L);
            empty.put("remainingSessions", 0L);
            return empty;
        }

        Map<String, Object> dashboard = buildPtDashboard(activePhase);
        int ptRequestId = (Integer) activePhase.get("ptRequestId");

        Map<String, Object> coach = new LinkedHashMap<>();
        coach.put("coachId", activePhase.get("coachId"));
        coach.put("coachName", activePhase.get("coachName"));
        coach.put("coachEmail", activePhase.get("coachEmail"));
        coach.put("coachPhone", activePhase.get("coachPhone"));

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("hasActivePt", true);
        context.put("status", "ACTIVE_PHASE");
        context.put("currentPtStatus", activePhase.get("status"));
        context.put("ptRequestId", activePhase.get("ptRequestId"));
        context.put("bookingMode", activePhase.get("bookingMode"));
        context.put("startDate", activePhase.get("startDate"));
        context.put("endDate", activePhase.get("endDate"));
        context.put("coach", coach);
        context.put("activePhase", activePhase);
        context.put("nextSession", dashboard.getOrDefault("nextSession", Map.of()));
        context.put("recentSessions", loadRecentSessionContext(ptRequestId));
        context.put("weeklySchedule", dashboard.getOrDefault("weeklySchedule", List.of()));
        context.put("templateSlots", activePhase.getOrDefault("templateSlots", List.of()));
        context.put("latestNoteSignal", dashboard.getOrDefault("latestNoteSignal", Map.of()));
        context.put("latestProgressSignal", dashboard.getOrDefault("latestProgressSignal", Map.of()));
        context.put("latestSignals", dashboard.getOrDefault("latestSignals", Map.of()));
        context.put("completedSessions", dashboard.getOrDefault("completedSessions", 0L));
        context.put("remainingSessions", dashboard.getOrDefault("remainingSessions", 0L));
        return context;
    }

    private Map<String, Object> loadActivePtPhase(int customerId) {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT TOP (1)
                    r.PTRequestID,
                    r.CustomerID,
                    r.CoachID,
                    r.CustomerMembershipID,
                    r.StartDate,
                    r.EndDate,
                    r.Status,
                    COALESCE(r.BookingMode, 'REQUEST') AS BookingMode,
                    coach.FullName AS CoachName,
                    coach.Email AS CoachEmail,
                    coach.Phone AS CoachPhone
                FROM dbo.PTRecurringRequests r
                JOIN dbo.Users coach ON coach.UserID = r.CoachID
                WHERE r.CustomerID = ?
                  AND r.Status = 'APPROVED'
                  AND r.EndDate >= CAST(GETDATE() AS DATE)
                ORDER BY r.EndDate DESC, r.PTRequestID DESC
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ptRequestId", rs.getInt("PTRequestID"));
            item.put("customerId", rs.getInt("CustomerID"));
            item.put("coachId", rs.getInt("CoachID"));
            item.put("coachName", rs.getString("CoachName"));
            item.put("coachEmail", rs.getString("CoachEmail"));
            item.put("coachPhone", rs.getString("CoachPhone"));
            item.put("customerMembershipId", rs.getInt("CustomerMembershipID"));
            item.put("startDate", dateToString(rs.getDate("StartDate").toLocalDate()));
            item.put("endDate", dateToString(rs.getDate("EndDate").toLocalDate()));
            item.put("status", rs.getString("Status"));
            item.put("bookingMode", rs.getString("BookingMode"));
            return item;
        }, customerId);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> activePhase = rows.getFirst();
        int ptRequestId = (Integer) activePhase.get("ptRequestId");
        activePhase.put("templateSlots", loadTemplateSlots(ptRequestId));
        return activePhase;
    }

    private List<Map<String, Object>> loadTemplateSlots(int ptRequestId) {
        return jdbcTemplate.query("""
                SELECT prs.DayOfWeek, prs.TimeSlotID, ts.SlotIndex, ts.StartTime, ts.EndTime
                FROM dbo.PTRequestSlots prs
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = prs.TimeSlotID
                WHERE prs.PTRequestID = ?
                ORDER BY prs.DayOfWeek, ts.SlotIndex
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("dayOfWeek", rs.getInt("DayOfWeek"));
            item.put("timeSlotId", rs.getInt("TimeSlotID"));
            item.put("slotIndex", rs.getInt("SlotIndex"));
            item.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            item.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            return item;
        }, ptRequestId);
    }

    private Map<String, Object> buildPtDashboard(Map<String, Object> activePhase) {
        int ptRequestId = (Integer) activePhase.get("ptRequestId");
        int customerId = (Integer) activePhase.get("customerId");
        LocalDate today = LocalDate.now();
        LocalDate weekEnd = today.plusDays(6);

        Map<String, Object> nextSession = jdbcTemplate.query("""
                SELECT TOP (1)
                    s.PTSessionID,
                    s.PTRequestID,
                    s.CoachID,
                    s.SessionDate,
                    s.DayOfWeek,
                    s.TimeSlotID,
                    s.Status,
                    s.CancelReason,
                    ts.SlotIndex,
                    ts.StartTime,
                    ts.EndTime,
                    coach.FullName AS CoachName,
                    coach.Phone AS CoachPhone
                FROM dbo.PTSessions s
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                JOIN dbo.Users coach ON coach.UserID = s.CoachID
                WHERE s.PTRequestID = ?
                  AND s.Status = 'SCHEDULED'
                  AND s.SessionDate >= CAST(GETDATE() AS DATE)
                ORDER BY s.SessionDate, ts.SlotIndex
                """, myScheduleRowMapper(), ptRequestId).stream().findFirst().orElse(null);

        List<Map<String, Object>> weeklySchedule = jdbcTemplate.query("""
                SELECT
                    s.PTSessionID,
                    s.PTRequestID,
                    s.CoachID,
                    s.SessionDate,
                    s.DayOfWeek,
                    s.TimeSlotID,
                    s.Status,
                    s.CancelReason,
                    ts.SlotIndex,
                    ts.StartTime,
                    ts.EndTime,
                    coach.FullName AS CoachName,
                    coach.Phone AS CoachPhone
                FROM dbo.PTSessions s
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                JOIN dbo.Users coach ON coach.UserID = s.CoachID
                WHERE s.PTRequestID = ?
                  AND s.SessionDate >= ?
                  AND s.SessionDate <= ?
                ORDER BY s.SessionDate, ts.SlotIndex
                """, myScheduleRowMapper(), ptRequestId, today, weekEnd);

        Map<String, Object> latestNote = jdbcTemplate.query("""
                SELECT TOP (1)
                    n.PTSessionNoteID,
                    n.PTSessionID,
                    n.NoteContent,
                    n.CreatedAt,
                    n.UpdatedAt,
                    s.SessionDate
                FROM dbo.PTSessionNotes n
                JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
                WHERE s.PTRequestID = ?
                ORDER BY COALESCE(n.UpdatedAt, n.CreatedAt) DESC, n.PTSessionNoteID DESC
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("noteId", rs.getInt("PTSessionNoteID"));
            item.put("ptSessionId", rs.getInt("PTSessionID"));
            item.put("noteContent", rs.getString("NoteContent"));
            item.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            item.put("updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt")));
            item.put("sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            return item;
        }, ptRequestId).stream().findFirst().orElse(null);

        Map<String, Object> latestProgress = jdbcTemplate.query("""
                SELECT TOP (1)
                    HeightCm,
                    WeightKg,
                    BMI,
                    RecordedAt
                FROM dbo.CustomerHealthHistory
                WHERE CustomerID = ?
                ORDER BY RecordedAt DESC
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("heightCm", rs.getBigDecimal("HeightCm"));
            item.put("weightKg", rs.getBigDecimal("WeightKg"));
            item.put("bmi", rs.getBigDecimal("BMI"));
            item.put("recordedAt", timestampToIso(rs.getTimestamp("RecordedAt")));
            return item;
        }, customerId).stream().findFirst().orElse(null);

        long completedSessions = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM dbo.PTSessions
                WHERE PTRequestID = ? AND Status = 'COMPLETED'
                """, Long.class, ptRequestId);

        long remainingSessions = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM dbo.PTSessions
                WHERE PTRequestID = ? AND Status = 'SCHEDULED'
                """, Long.class, ptRequestId);

        Map<String, Object> dashboard = new LinkedHashMap<>();
        attachReplacementOffers(customerId, weeklySchedule);
        if (nextSession != null) {
            attachReplacementOffer(customerId, nextSession);
        }
        Map<String, Object> latestNoteSignal = buildLatestNoteSignal(latestNote, activePhase);
        Map<String, Object> latestProgressSignal = buildLatestProgressSignal(latestProgress);
        dashboard.put("nextSession", nextSession == null ? Map.of() : nextSession);
        dashboard.put("weeklySchedule", weeklySchedule);
        dashboard.put("latestNote", latestNote == null ? Map.of() : latestNote);
        dashboard.put("latestProgress", latestProgress == null ? Map.of() : latestProgress);
        dashboard.put("latestNoteSignal", latestNoteSignal);
        dashboard.put("latestProgressSignal", latestProgressSignal);
        dashboard.put("latestSignals", Map.of(
                "latestNote", latestNoteSignal,
                "latestProgress", latestProgressSignal,
                "mostRecent", selectLatestSignal(latestNoteSignal, latestProgressSignal)));
        dashboard.put("completedSessions", completedSessions);
        dashboard.put("remainingSessions", remainingSessions);
        return dashboard;
    }

    private List<Map<String, Object>> loadRecentSessionContext(int ptRequestId) {
        return jdbcTemplate.query("""
                SELECT TOP (3)
                    s.PTSessionID,
                    s.PTRequestID,
                    s.CoachID,
                    s.SessionDate,
                    s.DayOfWeek,
                    s.TimeSlotID,
                    s.Status,
                    s.CancelReason,
                    ts.SlotIndex,
                    ts.StartTime,
                    ts.EndTime,
                    coach.FullName AS CoachName,
                    coach.Phone AS CoachPhone,
                    (
                        SELECT COUNT(*)
                        FROM dbo.PTSessionNotes n
                        WHERE n.PTSessionID = s.PTSessionID
                    ) AS NoteCount
                FROM dbo.PTSessions s
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                JOIN dbo.Users coach ON coach.UserID = s.CoachID
                WHERE s.PTRequestID = ?
                ORDER BY s.SessionDate DESC, ts.SlotIndex DESC
                """, (rs, i) -> {
            Map<String, Object> session = myScheduleRowMapper().mapRow(rs, i);
            Integer noteCount = parseInteger(rs.getObject("NoteCount"));
            int resolvedNoteCount = noteCount == null ? 0 : noteCount;
            session.put("noteCount", resolvedNoteCount);
            session.put("hasCoachNote", resolvedNoteCount > 0);
            return session;
        }, ptRequestId);
    }

    private Map<String, Object> buildLatestNoteSignal(
            Map<String, Object> latestNote,
            Map<String, Object> activePhase) {
        if (latestNote == null || latestNote.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("sourceType", "COACH_NOTE");
            empty.put("recordedAt", null);
            empty.put("summary", "No coaching note recorded yet.");
            empty.put("coachName", activePhase.get("coachName"));
            empty.put("sessionDate", null);
            empty.put("noteId", null);
            return empty;
        }

        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("sourceType", "COACH_NOTE");
        signal.put("recordedAt", firstNonBlank(
                asText(latestNote.get("updatedAt")),
                asText(latestNote.get("createdAt"))));
        signal.put("summary", latestNote.get("noteContent"));
        signal.put("coachName", activePhase.get("coachName"));
        signal.put("sessionDate", latestNote.get("sessionDate"));
        signal.put("noteId", latestNote.get("noteId"));
        return signal;
    }

    private Map<String, Object> buildLatestProgressSignal(Map<String, Object> latestProgress) {
        if (latestProgress == null || latestProgress.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("sourceType", "HEALTH_SNAPSHOT");
            empty.put("recordedAt", null);
            empty.put("summary", "No progress update recorded yet.");
            empty.put("heightCm", null);
            empty.put("weightKg", null);
            empty.put("bmi", null);
            return empty;
        }

        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("sourceType", "HEALTH_SNAPSHOT");
        signal.put("recordedAt", latestProgress.get("recordedAt"));
        signal.put("summary", "Latest progress update recorded at " + latestProgress.get("recordedAt") + ".");
        signal.put("heightCm", latestProgress.get("heightCm"));
        signal.put("weightKg", latestProgress.get("weightKg"));
        signal.put("bmi", latestProgress.get("bmi"));
        return signal;
    }

    private Map<String, Object> selectLatestSignal(
            Map<String, Object> latestNoteSignal,
            Map<String, Object> latestProgressSignal) {
        String latestNoteAt = asText(latestNoteSignal.get("recordedAt"));
        String latestProgressAt = asText(latestProgressSignal.get("recordedAt"));
        if (latestNoteAt == null && latestProgressAt == null) {
            return new LinkedHashMap<>(latestProgressSignal);
        }
        if (latestNoteAt != null && (latestProgressAt == null || latestNoteAt.compareTo(latestProgressAt) >= 0)) {
            return new LinkedHashMap<>(latestNoteSignal);
        }
        return new LinkedHashMap<>(latestProgressSignal);
    }

    private Map<String, Object> customerGetMySchedule(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT s.PTSessionID, s.PTRequestID, s.CoachID, s.SessionDate, s.DayOfWeek, s.TimeSlotID, s.Status, s.CancelReason,
                               ts.SlotIndex, ts.StartTime, ts.EndTime, u.FullName AS CoachName, u.Phone AS CoachPhone
                        FROM dbo.PTSessions s
                        JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                        JOIN dbo.Users u ON u.UserID = s.CoachID
                        WHERE s.CustomerID = ?
                        ORDER BY s.SessionDate DESC, ts.SlotIndex DESC
                        """,
                myScheduleRowMapper(), customer.userId());

        // Fetch all notes for this customer's sessions and group by session ID
        List<Map<String, Object>> allNotes = jdbcTemplate.query("""
                SELECT n.PTSessionID, n.NoteContent, n.UpdatedAt, n.CreatedAt
                FROM dbo.PTSessionNotes n
                JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
                WHERE s.CustomerID = ?
                ORDER BY n.CreatedAt ASC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("noteContent", rs.getString("NoteContent"));
            m.put("updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt")));
                m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            return m;
        }, customer.userId());

        List<Map<String, Object>> allFeedback = jdbcTemplate.query("""
                SELECT cf.PTSessionID, cf.CoachFeedbackID, cf.Rating, cf.Comment, cf.CreatedAt
                FROM dbo.CoachFeedback cf
                JOIN dbo.PTSessions s ON s.PTSessionID = cf.PTSessionID
                WHERE s.CustomerID = ?
                ORDER BY cf.CreatedAt DESC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("coachFeedbackId", rs.getInt("CoachFeedbackID"));
            m.put("rating", rs.getInt("Rating"));
            m.put("comment", rs.getString("Comment"));
            m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            return m;
        }, customer.userId());

        // Group notes by session ID
        Map<Integer, List<Map<String, Object>>> notesBySession = new LinkedHashMap<>();
        for (Map<String, Object> note : allNotes) {
            int sid = (Integer) note.get("ptSessionId");
            notesBySession.computeIfAbsent(sid, k -> new java.util.ArrayList<>()).add(note);
        }

        Map<Integer, Map<String, Object>> feedbackBySession = new LinkedHashMap<>();
        for (Map<String, Object> feedback : allFeedback) {
            int sid = (Integer) feedback.get("ptSessionId");
            feedbackBySession.putIfAbsent(sid, feedback);
        }

        // Attach notes to each session
        for (Map<String, Object> session : items) {
            int sid = (Integer) session.get("ptSessionId");
            session.put("notes", notesBySession.getOrDefault(sid, List.of()));
            Map<String, Object> feedback = feedbackBySession.get(sid);
            session.put("feedback", feedback == null ? Map.of() : feedback);
            session.put("hasFeedback", feedback != null);
            RescheduleMeta meta = parseRescheduleMeta(asText(session.get("cancelReason")));
            if (meta != null) {
                Map<String, Object> reschedule = new LinkedHashMap<>();
                reschedule.put("status", meta.state());
                reschedule.put("requestedSessionDate", dateToString(meta.requestedDate()));
                reschedule.put("requestedTimeSlotId", meta.requestedTimeSlotId());
                reschedule.put("note", meta.note());
                session.put("reschedule", reschedule);
            }
        }
        attachReplacementOffers(customer.userId(), items);

        // Fetch pending requests separately
        List<Map<String, Object>> pendingRequests = jdbcTemplate.query("""
                SELECT r.PTRequestID, r.CoachID, r.StartDate, r.EndDate, r.Status, r.CreatedAt,
                       u.FullName AS CoachName, u.Phone AS CoachPhone
                FROM dbo.PTRecurringRequests r
                JOIN dbo.Users u ON u.UserID = r.CoachID
                WHERE r.CustomerID = ? AND r.Status = 'PENDING'
                ORDER BY r.CreatedAt DESC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptRequestId", rs.getInt("PTRequestID"));
            m.put("coachId", rs.getInt("CoachID"));
            m.put("coachName", rs.getString("CoachName"));
            m.put("coachPhone", rs.getString("CoachPhone"));
            m.put("startDate", dateToString(rs.getDate("StartDate").toLocalDate()));
            m.put("endDate", dateToString(rs.getDate("EndDate").toLocalDate()));
            m.put("status", rs.getString("Status"));
            m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            return m;
        }, customer.userId());

        List<Map<String, Object>> deniedRequests;
        if (hasPtRequestDenyReasonColumn()) {
            deniedRequests = jdbcTemplate.query("""
                    SELECT r.PTRequestID, r.CoachID, r.StartDate, r.EndDate, r.Status, r.CreatedAt, r.UpdatedAt, r.DenyReason,
                           u.FullName AS CoachName, u.Phone AS CoachPhone
                    FROM dbo.PTRecurringRequests r
                    JOIN dbo.Users u ON u.UserID = r.CoachID
                    WHERE r.CustomerID = ? AND r.Status = 'DENIED'
                    ORDER BY COALESCE(r.UpdatedAt, r.CreatedAt) DESC
                    """, (rs, i) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("ptRequestId", rs.getInt("PTRequestID"));
                m.put("coachId", rs.getInt("CoachID"));
                m.put("coachName", rs.getString("CoachName"));
                m.put("coachPhone", rs.getString("CoachPhone"));
                m.put("startDate", dateToString(rs.getDate("StartDate").toLocalDate()));
                m.put("endDate", dateToString(rs.getDate("EndDate").toLocalDate()));
                m.put("status", rs.getString("Status"));
                m.put("denyReason", rs.getString("DenyReason"));
                m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
                m.put("updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt")));
                return m;
            }, customer.userId());
        } else {
            deniedRequests = jdbcTemplate.query("""
                    SELECT r.PTRequestID, r.CoachID, r.StartDate, r.EndDate, r.Status, r.CreatedAt, r.UpdatedAt,
                           u.FullName AS CoachName, u.Phone AS CoachPhone
                    FROM dbo.PTRecurringRequests r
                    JOIN dbo.Users u ON u.UserID = r.CoachID
                    WHERE r.CustomerID = ? AND r.Status = 'DENIED'
                    ORDER BY COALESCE(r.UpdatedAt, r.CreatedAt) DESC
                    """, (rs, i) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("ptRequestId", rs.getInt("PTRequestID"));
                m.put("coachId", rs.getInt("CoachID"));
                m.put("coachName", rs.getString("CoachName"));
                m.put("coachPhone", rs.getString("CoachPhone"));
                m.put("startDate", dateToString(rs.getDate("StartDate").toLocalDate()));
                m.put("endDate", dateToString(rs.getDate("EndDate").toLocalDate()));
                m.put("status", rs.getString("Status"));
                m.put("denyReason", null);
                m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
                m.put("updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt")));
                return m;
            }, customer.userId());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("pendingRequests", pendingRequests);
        result.put("deniedRequests", deniedRequests);
        result.putAll(buildCurrentPhaseResponse(customer.userId()));
        return result;
    }

    private Map<String, Object> customerCancelSession(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        int sessionId = requireInteger(payload, "sessionId");
        String reason = asText(((Map<?, ?>) payload.getOrDefault("body", Map.of())).get("cancelReason"));
        SessionNotificationContext session = loadSessionNotificationContext(sessionId);

        int updated = jdbcTemplate.update(
                """
                        UPDATE dbo.PTSessions SET Status = 'CANCELLED', CancelReason = ?, UpdatedAt = SYSDATETIME()
                        WHERE PTSessionID = ? AND CustomerID = ? AND Status = 'SCHEDULED' AND SessionDate >= CAST(GETDATE() AS DATE)
                        """,
                reason != null ? reason : "Cancelled by customer", sessionId, customer.userId());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Session not found, already cancelled, or cannot be cancelled (past or not yours).");
        }
        String resolvedReason = reason != null ? reason : "Cancelled by customer";
        notifyCustomerCancelledSession(session, resolvedReason);
        return Map.of("sessionId", sessionId, "status", "CANCELLED");
    }

    private Map<String, Object> customerRescheduleSession(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        int sessionId = requireInteger(payload, "sessionId");
        Map<String, Object> body = asMap(payload.get("body"));
        String newDateStr = asText(body.get("sessionDate"));
        Integer newTimeSlotId = parseInteger(body.get("timeSlotId"));
        if (newDateStr == null || newTimeSlotId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionDate and timeSlotId are required.");
        }
        String reason = asText(body.get("reason"));
        LocalDate newDate = LocalDate.parse(newDateStr);

        Map<String, Object> session = jdbcTemplate.query(
                """
                        SELECT s.CoachID, s.SessionDate, s.TimeSlotID, s.Status, s.CancelReason, s.PTRequestID, r.CoachID AS PrimaryCoachID, r.EndDate
                        FROM dbo.PTSessions s
                        JOIN dbo.PTRecurringRequests r ON r.PTRequestID = s.PTRequestID
                        WHERE s.PTSessionID = ? AND s.CustomerID = ?
                        """,
                (rs, i) -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("coachId", rs.getInt("CoachID"));
                    item.put("sessionDate", rs.getDate("SessionDate").toLocalDate());
                    item.put("timeSlotId", rs.getInt("TimeSlotID"));
                    item.put("status", rs.getString("Status"));
                    item.put("cancelReason", rs.getString("CancelReason"));
                    item.put("ptRequestId", rs.getInt("PTRequestID"));
                    item.put("primaryCoachId", rs.getInt("PrimaryCoachID"));
                    item.put("endDate", rs.getDate("EndDate").toLocalDate());
                    return item;
                },
                sessionId, customer.userId()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        int coachId = (Integer) session.get("coachId");
        int primaryCoachId = (Integer) session.get("primaryCoachId");
        String status = String.valueOf(session.get("status"));
        if (!"SCHEDULED".equalsIgnoreCase(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only SCHEDULED sessions can be rescheduled.");
        }
        if (coachId != primaryCoachId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This exception session is no longer under your primary coach. Please resolve it through the exception flow.");
        }

        LocalDate currentDate = (LocalDate) session.get("sessionDate");
        if (LocalDate.now().isAfter(currentDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reschedule a past session.");
        }
        if (newDate.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reschedule to a past date.");
        }
        if (newDate.isAfter((LocalDate) session.get("endDate"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New slot must stay inside your current PT phase.");
        }
        enforceSessionCutoff(currentDate, (Integer) session.get("timeSlotId"));
        enforceSessionCutoff(newDate, newTimeSlotId);
        if (!isCoachWeeklyAvailable(coachId, newDate.getDayOfWeek().getValue(), newTimeSlotId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach is not available for requested slot.");
        }
        if (hasCoachConflict(coachId, newDate, newTimeSlotId, sessionId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach is not available at the chosen slot.");
        }
        if (hasPendingReplacementOffer(sessionId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Resolve the pending replacement offer before changing this PT session.");
        }

        jdbcTemplate.update("""
                UPDATE dbo.PTSessions
                SET SessionDate = ?, TimeSlotID = ?, DayOfWeek = ?, CancelReason = NULL, UpdatedAt = SYSDATETIME()
                WHERE PTSessionID = ? AND CustomerID = ?
                """, newDate, newTimeSlotId, newDate.getDayOfWeek().getValue(), sessionId, customer.userId());
        notifyDirectReschedule(sessionId, customer.userId(), coachId, requestedSlotSummary(currentDate,
                (Integer) session.get("timeSlotId")), requestedSlotSummary(newDate, newTimeSlotId), reason);
        return Map.of(
                "sessionId", sessionId,
                "status", "RESCHEDULED",
                "requestedSessionDate", newDateStr,
                "requestedTimeSlotId", newTimeSlotId,
                "message", "Session moved successfully.");
    }

    @Transactional
    private Map<String, Object> customerRescheduleSeries(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        Map<String, Object> body = asMap(payload.get("body"));
        String cutoverDateText = requireText(body, "cutoverDate");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> slots = (List<Map<String, Object>>) body.get("slots");
        if (slots == null || slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one recurring slot is required.");
        }

        Map<String, Object> activePhase = loadActivePtPhase(customer.userId());
        if (activePhase == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active PT phase was found.");
        }

        LocalDate cutoverDate = LocalDate.parse(cutoverDateText);
        LocalDate today = LocalDate.now();
        LocalDate phaseEndDate = LocalDate.parse(String.valueOf(activePhase.get("endDate")));
        int ptRequestId = (Integer) activePhase.get("ptRequestId");
        int coachId = (Integer) activePhase.get("coachId");
        if (cutoverDate.isBefore(today.plusDays(1))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Series changes must start from a future date.");
        }
        if (cutoverDate.isAfter(phaseEndDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Series change start must remain inside the current PT phase.");
        }

        List<RequestedSlot> requestedSlots = normalizeRequestedSlots(slots);
        List<Map<String, Object>> normalizedSlots = toRequestedSlotMaps(requestedSlots);
        for (RequestedSlot requestedSlot : requestedSlots) {
            if (!isCoachWeeklyAvailable(coachId, requestedSlot.dayOfWeek(), requestedSlot.timeSlotId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Your primary coach is not available for every requested recurring slot.");
            }
        }

        List<Map<String, Object>> preservedFutureSessions = jdbcTemplate.query("""
                SELECT PTSessionID, SessionDate, TimeSlotID, Status
                FROM dbo.PTSessions
                WHERE PTRequestID = ?
                  AND SessionDate >= ?
                  AND Status <> 'SCHEDULED'
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ptSessionId", rs.getInt("PTSessionID"));
            item.put("sessionDate", rs.getDate("SessionDate").toLocalDate());
            item.put("timeSlotId", rs.getInt("TimeSlotID"));
            item.put("status", rs.getString("Status"));
            return item;
        }, ptRequestId, cutoverDate);

        jdbcTemplate.update("""
                DELETE FROM dbo.PTSessions
                WHERE PTRequestID = ?
                  AND Status = 'SCHEDULED'
                  AND SessionDate >= ?
                """, ptRequestId, cutoverDate);

        jdbcTemplate.update("DELETE FROM dbo.PTRequestSlots WHERE PTRequestID = ?", ptRequestId);
        insertPtRequestSlots(ptRequestId, normalizedSlots);

        int created = regenerateFuturePtSessions(ptRequestId, customer.userId(), coachId, cutoverDate, phaseEndDate,
                normalizedSlots, preservedFutureSessions);

        notificationService.notifyUser(
                coachId,
                "PT_SERIES_CHANGED",
                "PT recurring schedule updated",
                loadUserFullName(customer.userId()) + " changed the recurring PT template from "
                        + dateToString(cutoverDate) + " onward.",
                "/coach/booking-requests",
                ptRequestId,
                "PT_SERIES_CHANGED_" + ptRequestId + "_" + dateToString(cutoverDate));

        return Map.of(
                "ptRequestId", ptRequestId,
                "status", "UPDATED",
                "cutoverDate", dateToString(cutoverDate),
                "sessionsCreated", created,
                "message", "Recurring PT series updated successfully.");
    }

    @Transactional
    private Map<String, Object> customerRespondReplacementOffer(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        int sessionId = requireInteger(payload, "sessionId");
        Map<String, Object> body = asMap(payload.get("body"));
        String decision = requireText(body, "decision").toUpperCase();
        if (!"ACCEPT".equals(decision) && !"DECLINE".equals(decision)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "decision must be ACCEPT or DECLINE.");
        }

        Map<String, Object> offer = loadPendingReplacementOfferForCustomer(sessionId, customer.userId());
        int offerId = (Integer) offer.get("offerId");
        int replacementCoachId = (Integer) offer.get("replacementCoachId");
        LocalDate sessionDate = (LocalDate) offer.get("sessionDate");
        int timeSlotId = (Integer) offer.get("timeSlotId");

        if ("ACCEPT".equals(decision)) {
            if (!isCoachWeeklyAvailable(replacementCoachId, sessionDate.getDayOfWeek().getValue(), timeSlotId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Replacement coach is no longer available for this slot.");
            }
            if (hasCoachConflict(replacementCoachId, sessionDate, timeSlotId, sessionId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Replacement coach now has a conflict in this slot.");
            }
            jdbcTemplate.update("""
                    UPDATE dbo.PTSessions
                    SET CoachID = ?, UpdatedAt = SYSDATETIME()
                    WHERE PTSessionID = ? AND CustomerID = ?
                    """, replacementCoachId, sessionId, customer.userId());
        }

        jdbcTemplate.update("""
                UPDATE dbo.PTSessionReplacementOffers
                SET Status = ?, CustomerRespondedAt = SYSDATETIME(), UpdatedAt = SYSDATETIME()
                WHERE OfferID = ?
                """, "ACCEPT".equals(decision) ? "ACCEPTED" : "DECLINED", offerId);

        notifyReplacementOfferDecision(sessionId, (Integer) offer.get("originalCoachId"), replacementCoachId, decision);

        return Map.of(
                "sessionId", sessionId,
                "status", "ACCEPT".equals(decision) ? "ACCEPTED" : "DECLINED",
                "message", "ACCEPT".equals(decision)
                        ? "Replacement coach accepted for this PT session."
                        : "Replacement coach declined for this PT session.");
    }

    private Map<String, Object> customerSubmitFeedback(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        int sessionId = requireInteger(payload, "ptSessionId");
        int rating = requireInteger(payload, "rating");
        if (rating < 1 || rating > 5)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be 1-5.");
        String comment = asText(payload.get("comment"));

        List<Integer> coachIds = jdbcTemplate.query("""
                SELECT CoachID FROM dbo.PTSessions WHERE PTSessionID = ? AND CustomerID = ? AND Status = 'COMPLETED'
                """, (rs, i) -> rs.getInt("CoachID"), sessionId, customer.userId());
        if (coachIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Session not found or not completed. Only completed sessions can be rated.");
        }

        int coachId = coachIds.get(0);
        try {
            jdbcTemplate.update("""
                    INSERT INTO dbo.CoachFeedback (PTSessionID, CustomerID, CoachID, Rating, Comment)
                    VALUES (?, ?, ?, ?, ?)
                    """, sessionId, customer.userId(), coachId, rating, comment);
        } catch (DataAccessException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Feedback already submitted for this session.");
        }
        return Map.of("ptSessionId", sessionId, "rating", rating, "message", "Feedback submitted.");
    }

    private Map<String, Object> coachGetPtRequests(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT r.PTRequestID, r.CustomerID, r.StartDate, r.EndDate, r.Status, r.CreatedAt,
                       u.FullName AS CustomerName, u.Email AS CustomerEmail, u.Phone AS CustomerPhone
                FROM dbo.PTRecurringRequests r
                JOIN dbo.Users u ON u.UserID = r.CustomerID
                WHERE r.CoachID = ? AND r.Status = 'PENDING' AND COALESCE(r.BookingMode, 'REQUEST') = 'REQUEST'
                ORDER BY r.CreatedAt DESC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            int id = rs.getInt("PTRequestID");
            m.put("ptRequestId", id);
            m.put("customerId", rs.getInt("CustomerID"));
            m.put("customerName", rs.getString("CustomerName"));
            m.put("customerEmail", rs.getString("CustomerEmail"));
            m.put("customerPhone", rs.getString("CustomerPhone"));
            m.put("startDate", dateToString(rs.getDate("StartDate").toLocalDate()));
            m.put("endDate", dateToString(rs.getDate("EndDate").toLocalDate()));
            m.put("status", rs.getString("Status"));
            m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));

            m.put("slots", loadTemplateSlots(id));
            return m;
        }, coach.userId());
        return Map.of("items", items);
    }

    private Map<String, Object> coachGetRescheduleRequests(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int coachId = coach.userId();

        Map<Integer, Map<String, Object>> timeSlotMap = loadTimeSlotMap();
        List<Map<String, Object>> items = new ArrayList<>();

        List<Map<String, Object>> raw = jdbcTemplate.query("""
                SELECT s.PTSessionID, s.CustomerID, s.SessionDate, s.TimeSlotID, s.CancelReason,
                       u.FullName AS CustomerName, u.Email AS CustomerEmail, u.Phone AS CustomerPhone
                FROM dbo.PTSessions s
                JOIN dbo.Users u ON u.UserID = s.CustomerID
                WHERE s.CoachID = ? AND s.Status = 'SCHEDULED' AND s.CancelReason LIKE ?
                ORDER BY s.UpdatedAt DESC, s.PTSessionID DESC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("customerId", rs.getInt("CustomerID"));
            m.put("customerName", rs.getString("CustomerName"));
            m.put("customerEmail", rs.getString("CustomerEmail"));
            m.put("customerPhone", rs.getString("CustomerPhone"));
            m.put("currentSessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            m.put("currentTimeSlotId", rs.getInt("TimeSlotID"));
            m.put("cancelReason", rs.getString("CancelReason"));
            return m;
        }, coachId, RESCHEDULE_REQUEST_PREFIX + "%");

        for (Map<String, Object> row : raw) {
            RescheduleMeta meta = parseRescheduleMeta(asText(row.get("cancelReason")));
            if (meta == null || !"PENDING".equals(meta.state())) {
                continue;
            }

            int sessionId = requireInteger(row, "ptSessionId");
            int requestedTimeSlotId = meta.requestedTimeSlotId();
            LocalDate requestedDate = meta.requestedDate();

            Map<String, Object> out = new LinkedHashMap<>(row);
            out.remove("cancelReason");
            out.put("requestedSessionDate", dateToString(requestedDate));
            out.put("requestedTimeSlotId", requestedTimeSlotId);
            out.put("reason", meta.note());

            Map<String, Object> currentSlot = timeSlotMap.getOrDefault(requireInteger(row, "currentTimeSlotId"), Map.of());
            Map<String, Object> requestedSlot = timeSlotMap.getOrDefault(requestedTimeSlotId, Map.of());
            out.put("currentSlot", currentSlot);
            out.put("requestedSlot", requestedSlot);

            boolean weeklyAvailable = isCoachWeeklyAvailable(coachId, requestedDate.getDayOfWeek().getValue(),
                    requestedTimeSlotId);
            boolean hasConflict = hasCoachConflict(coachId, requestedDate, requestedTimeSlotId, sessionId);
            out.put("weeklyAvailable", weeklyAvailable);
            out.put("hasConflict", hasConflict);

            items.add(out);
        }

        return Map.of("items", items);
    }

    @Transactional
    private Map<String, Object> coachApproveRescheduleRequest(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");

        Map<String, Object> row = jdbcTemplate.query("""
                SELECT PTSessionID, SessionDate, TimeSlotID, Status, CancelReason
                FROM dbo.PTSessions
                WHERE PTSessionID = ? AND CoachID = ?
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("status", rs.getString("Status"));
            m.put("cancelReason", rs.getString("CancelReason"));
            m.put("sessionDate", rs.getDate("SessionDate").toLocalDate());
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            return m;
        }, sessionId, coach.userId()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        if (!"SCHEDULED".equalsIgnoreCase(String.valueOf(row.get("status")))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is not in SCHEDULED status.");
        }

        RescheduleMeta meta = parseRescheduleMeta(asText(row.get("cancelReason")));
        if (meta == null || !"PENDING".equals(meta.state())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No pending reschedule request for this session.");
        }

        LocalDate requestedDate = meta.requestedDate();
        int requestedTimeSlotId = meta.requestedTimeSlotId();
        if (requestedDate.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested date is already in the past.");
        }
        if (!isCoachWeeklyAvailable(coach.userId(), requestedDate.getDayOfWeek().getValue(), requestedTimeSlotId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested slot is not in coach weekly availability.");
        }
        if (hasCoachConflict(coach.userId(), requestedDate, requestedTimeSlotId, sessionId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested slot now conflicts with another PT session.");
        }

        jdbcTemplate.update("""
                UPDATE dbo.PTSessions
                SET SessionDate = ?, TimeSlotID = ?, DayOfWeek = ?, CancelReason = NULL, UpdatedAt = SYSDATETIME()
                WHERE PTSessionID = ? AND CoachID = ?
                """, requestedDate, requestedTimeSlotId, requestedDate.getDayOfWeek().getValue(), sessionId, coach.userId());

        notifyCustomerAboutRescheduleDecision(sessionId, "APPROVED",
                "Your coach approved the reschedule request. New slot: " + requestedSlotSummary(requestedDate, requestedTimeSlotId));

        return Map.of(
                "ptSessionId", sessionId,
                "status", "APPROVED",
                "sessionDate", dateToString(requestedDate),
                "timeSlotId", requestedTimeSlotId,
                "message", "Reschedule request approved.");
    }

    private Map<String, Object> coachDenyRescheduleRequest(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");
        Map<String, Object> body = asMap(payload.get("body"));
        String reason = asText(body.get("reason"));

        Map<String, Object> row = jdbcTemplate.query("""
                SELECT CancelReason, Status
                FROM dbo.PTSessions
                WHERE PTSessionID = ? AND CoachID = ?
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("status", rs.getString("Status"));
            m.put("cancelReason", rs.getString("CancelReason"));
            return m;
        }, sessionId, coach.userId()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        if (!"SCHEDULED".equalsIgnoreCase(String.valueOf(row.get("status")))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is not in SCHEDULED status.");
        }
        RescheduleMeta meta = parseRescheduleMeta(asText(row.get("cancelReason")));
        if (meta == null || !"PENDING".equals(meta.state())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No pending reschedule request for this session.");
        }

        jdbcTemplate.update("""
                UPDATE dbo.PTSessions
                SET CancelReason = ?, UpdatedAt = SYSDATETIME()
                WHERE PTSessionID = ? AND CoachID = ?
                """, encodeRescheduleDenied(meta.requestedDate(), meta.requestedTimeSlotId(), reason), sessionId, coach.userId());

        notifyCustomerAboutRescheduleDecision(sessionId, "DENIED",
                "Your coach denied the reschedule request." + (reason == null || reason.isBlank() ? "" : " Reason: " + reason));

        return Map.of(
                "ptSessionId", sessionId,
                "status", "DENIED",
                "message", "Reschedule request denied.");
    }

    @Transactional
    private Map<String, Object> coachApprovePtRequest(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int requestId = requireInteger(payload, "requestId");

        Map<String, Object> req = jdbcTemplate.query("""
                SELECT CustomerID, CustomerMembershipID, StartDate, EndDate, Status FROM dbo.PTRecurringRequests
                WHERE PTRequestID = ? AND CoachID = ?
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("customerId", rs.getInt("CustomerID"));
            m.put("customerMembershipId", rs.getInt("CustomerMembershipID"));
            m.put("startDate", rs.getDate("StartDate").toLocalDate());
            m.put("endDate", rs.getDate("EndDate").toLocalDate());
            m.put("status", rs.getString("Status"));
            return m;
        }, requestId, coach.userId()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));

        if (!"PENDING".equalsIgnoreCase((String) req.get("status"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is already processed.");
        }

        List<Map<String, Object>> slots = jdbcTemplate.query("""
                SELECT DayOfWeek, TimeSlotID FROM dbo.PTRequestSlots WHERE PTRequestID = ?
                """, (rs, i) -> Map.of("dayOfWeek", rs.getInt("DayOfWeek"), "timeSlotId", rs.getInt("TimeSlotID")),
                requestId);

        LocalDate requestedStartDate = (LocalDate) req.get("startDate");
        LocalDate actualStartDate = LocalDate.now().plusDays(1);
        if (requestedStartDate != null && requestedStartDate.isAfter(actualStartDate)) {
            actualStartDate = requestedStartDate;
        }
        LocalDate endDate = (LocalDate) req.get("endDate");
        if (actualStartDate.isAfter(endDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This request can no longer be approved because the selected coaching window has already passed.");
        }
        requireValidMembershipForPt(
                (Integer) req.get("customerId"),
                (Integer) req.get("customerMembershipId"),
                actualStartDate,
                endDate);

        if (hasPtRequestDenyReasonColumn()) {
            jdbcTemplate.update(
                    "UPDATE dbo.PTRecurringRequests SET StartDate = ?, Status = 'APPROVED', DenyReason = NULL, UpdatedAt = SYSDATETIME() WHERE PTRequestID = ?",
                    actualStartDate, requestId);
        } else {
            jdbcTemplate.update(
                    "UPDATE dbo.PTRecurringRequests SET StartDate = ?, Status = 'APPROVED', UpdatedAt = SYSDATETIME() WHERE PTRequestID = ?",
                    actualStartDate, requestId);
        }

        int count = generatePTSessions(requestId, (Integer) req.get("customerId"), coach.userId(),
                actualStartDate, endDate, slots);

        notifyPtRequestDecision(requestId, (Integer) req.get("customerId"), "APPROVED",
                "Your PT booking request was approved. Coaching starts on " + dateToString(actualStartDate) + ".");

        return Map.of(
                "ptRequestId", requestId,
                "status", "APPROVED",
                "startDate", dateToString(actualStartDate),
                "endDate", dateToString(endDate),
                "sessionsCreated", count);
    }

    private Map<String, Object> coachDenyPtRequest(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int requestId = requireInteger(payload, "requestId");
        Map<String, Object> body = asMap(payload.get("body"));
        String reason = asText(body.get("reason"));
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deny reason is required.");
        }
        if (!hasPtRequestDenyReasonColumn()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Deny reason column is missing. Run docs/alter.txt to add PTRecurringRequests.DenyReason.");
        }

        int updated = jdbcTemplate.update(
                "UPDATE dbo.PTRecurringRequests SET Status = 'DENIED', DenyReason = ?, UpdatedAt = SYSDATETIME() WHERE PTRequestID = ? AND CoachID = ? AND Status = 'PENDING'",
                reason, requestId, coach.userId());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request not found or already processed.");
        }
        Integer customerId = jdbcTemplate.queryForObject(
                "SELECT CustomerID FROM dbo.PTRecurringRequests WHERE PTRequestID = ?",
                Integer.class, requestId);
        if (customerId != null) {
            notifyPtRequestDecision(requestId, customerId, "DENIED",
                    "Your PT booking request was denied. Reason: " + reason);
        }
        return Map.of("ptRequestId", requestId, "status", "DENIED");
    }

    // ---------- Coach ----------

    @Transactional
    private Map<String, Object> coachUpdateAvailability(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> slots = (List<Map<String, Object>>) payload.get("slots");
        if (slots == null || slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slots array is required.");
        }
        int coachId = coach.userId();
        boolean acceptingCustomerRequests = payload.get("acceptingCustomerRequests") == null
                || Boolean.TRUE.equals(payload.get("acceptingCustomerRequests"));
        jdbcTemplate.update("DELETE FROM dbo.CoachWeeklyAvailability WHERE CoachID = ?", coachId);
        int insertedCount = 0;
        for (Map<String, Object> slot : slots) {
            int dayOfWeek = requireInteger(slot, "dayOfWeek");
            int timeSlotId = requireInteger(slot, "timeSlotId");
            boolean isAvailable = slot.get("isAvailable") != null && Boolean.TRUE.equals(slot.get("isAvailable"));
            if (!isAvailable)
                continue;
            jdbcTemplate.update("""
                    INSERT INTO dbo.CoachWeeklyAvailability (CoachID, DayOfWeek, TimeSlotID)
                    VALUES (?, ?, ?)
                    """, coachId, dayOfWeek, timeSlotId);
            insertedCount++;
        }
        String existingBio = jdbcTemplate.queryForObject(
                "SELECT Bio FROM dbo.Coaches WHERE CoachID = ?",
                String.class,
                coachId);
        jdbcTemplate.update(
                "UPDATE dbo.Coaches SET Bio = ? WHERE CoachID = ?",
                mergeCoachAvailabilityFlagIntoBio(existingBio, acceptingCustomerRequests),
                coachId);
        return Map.of(
                "message", "Availability updated successfully.",
                "inserted", insertedCount,
                "total", insertedCount,
                "acceptingCustomerRequests", acceptingCustomerRequests);
    }

    private Map<String, Object> coachGetMyAvailability(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> weeklyAvailability = loadWeeklyAvailability(coach.userId());
        String rawBio = jdbcTemplate.queryForObject(
                "SELECT Bio FROM dbo.Coaches WHERE CoachID = ?",
                String.class,
                coach.userId());
        return Map.of(
                "weeklyAvailability", weeklyAvailability,
                "acceptingCustomerRequests", extractCoachMatchAvailability(rawBio));
    }

    private Map<String, Object> coachGetSchedule(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        return coachGetPtSessionsInternal(coach.userId(), payload);
    }

    private Map<String, Object> coachGetPtSessions(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        return coachGetPtSessionsInternal(coach.userId(), payload);
    }

    private Map<String, Object> coachGetPtSessionsInternal(int coachId, Map<String, Object> payload) {
        String fromStr = asText(payload.get("fromDate"));
        String toStr = asText(payload.get("toDate"));
        LocalDate from = fromStr != null ? LocalDate.parse(fromStr) : LocalDate.now().minusDays(7);
        LocalDate to = toStr != null ? LocalDate.parse(toStr) : from.plusDays(28);

        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT s.PTSessionID, s.PTRequestID, s.CustomerID, s.SessionDate, s.DayOfWeek, s.TimeSlotID, s.Status,
                               ts.SlotIndex, ts.StartTime, ts.EndTime, u.FullName AS CustomerName, u.Email AS CustomerEmail, u.Phone AS CustomerPhone,
                               u.AvatarUrl
                        FROM dbo.PTSessions s
                        JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                        JOIN dbo.Users u ON u.UserID = s.CustomerID
                        WHERE s.CoachID = ? AND s.SessionDate >= ? AND s.SessionDate <= ?
                        ORDER BY s.SessionDate, ts.SlotIndex
                        """,
                coachSessionRowMapper(), coachId, from, to);
        return Map.of("items", items, "fromDate", dateToString(from), "toDate", dateToString(to));
    }

    private Map<String, Object> coachGetUnavailableBlocks(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT b.UnavailableBlockID, b.StartDate, b.EndDate, b.TimeSlotID, b.Note, b.CreatedAt,
                       ts.SlotIndex, ts.StartTime, ts.EndTime
                FROM dbo.CoachUnavailableBlocks b
                LEFT JOIN dbo.TimeSlots ts ON ts.TimeSlotID = b.TimeSlotID
                WHERE b.CoachID = ? AND b.IsActive = 1
                ORDER BY b.StartDate DESC, COALESCE(ts.SlotIndex, 0) DESC, b.UnavailableBlockID DESC
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("unavailableBlockId", rs.getInt("UnavailableBlockID"));
            item.put("startDate", dateToString(rs.getDate("StartDate").toLocalDate()));
            item.put("endDate", dateToString(rs.getDate("EndDate").toLocalDate()));
            item.put("timeSlotId", parseInteger(rs.getObject("TimeSlotID")));
            item.put("note", rs.getString("Note"));
            item.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            if (rs.getObject("TimeSlotID") != null) {
                Map<String, Object> slot = new LinkedHashMap<>();
                slot.put("timeSlotId", rs.getInt("TimeSlotID"));
                slot.put("slotIndex", rs.getInt("SlotIndex"));
                slot.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
                slot.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
                item.put("slot", slot);
            }
            return item;
        }, coach.userId());
        return Map.of("items", items);
    }

    @Transactional
    private Map<String, Object> coachCreateUnavailableBlock(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        String startDateText = requireText(payload, "startDate");
        String endDateText = requireText(payload, "endDate");
        Integer timeSlotId = parseInteger(payload.get("timeSlotId"));
        String note = asText(payload.get("note"));
        LocalDate startDate = LocalDate.parse(startDateText);
        LocalDate endDate = LocalDate.parse(endDateText);
        if (startDate.isAfter(endDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startDate must be on or before endDate.");
        }
        if (endDate.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unavailable block must affect today or future dates.");
        }
        if (timeSlotId != null) {
            requireTimeSlotExists(timeSlotId);
        }

        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.CoachUnavailableBlocks (CoachID, StartDate, EndDate, TimeSlotID, Note, IsActive)
                    VALUES (?, ?, ?, ?, ?, 1)
                    """, new String[] { "UnavailableBlockID" });
            statement.setInt(1, coach.userId());
            statement.setObject(2, startDate);
            statement.setObject(3, endDate);
            if (timeSlotId == null) {
                statement.setNull(4, java.sql.Types.INTEGER);
            } else {
                statement.setInt(4, timeSlotId);
            }
            statement.setString(5, note);
            return statement;
        }, keyHolder);
        int unavailableBlockId = keyHolder.getKey() != null ? keyHolder.getKey().intValue() : 0;
        int impactedCount = countImpactedSessionsForBlock(coach.userId(), startDate, endDate, timeSlotId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("unavailableBlockId", unavailableBlockId);
        response.put("startDate", dateToString(startDate));
        response.put("endDate", dateToString(endDate));
        response.put("timeSlotId", timeSlotId);
        response.put("impactedSessions", impactedCount);
        response.put("message", "Unavailable block saved successfully.");
        return response;
    }

    private Map<String, Object> coachGetExceptionSessions(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                WITH LatestOffer AS (
                    SELECT *,
                           ROW_NUMBER() OVER (PARTITION BY PTSessionID ORDER BY CreatedAt DESC, OfferID DESC) AS rn
                    FROM dbo.PTSessionReplacementOffers
                    WHERE OriginalCoachID = ?
                )
                SELECT DISTINCT
                    s.PTSessionID,
                    s.PTRequestID,
                    s.CustomerID,
                    uCustomer.FullName AS CustomerName,
                    uCustomer.Email AS CustomerEmail,
                    uCustomer.Phone AS CustomerPhone,
                    s.SessionDate,
                    s.TimeSlotID,
                    ts.SlotIndex,
                    ts.StartTime,
                    ts.EndTime,
                    b.UnavailableBlockID,
                    b.StartDate AS BlockStartDate,
                    b.EndDate AS BlockEndDate,
                    b.Note AS BlockNote,
                    lo.OfferID,
                    lo.ReplacementCoachID,
                    lo.Status AS OfferStatus,
                    lo.Note AS OfferNote,
                    replacementCoach.FullName AS ReplacementCoachName
                FROM dbo.PTSessions s
                JOIN dbo.Users uCustomer ON uCustomer.UserID = s.CustomerID
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                LEFT JOIN dbo.CoachUnavailableBlocks b
                  ON b.CoachID = ?
                 AND b.IsActive = 1
                 AND s.SessionDate BETWEEN b.StartDate AND b.EndDate
                 AND (b.TimeSlotID IS NULL OR b.TimeSlotID = s.TimeSlotID)
                LEFT JOIN LatestOffer lo
                  ON lo.PTSessionID = s.PTSessionID
                 AND lo.rn = 1
                LEFT JOIN dbo.Users replacementCoach
                  ON replacementCoach.UserID = lo.ReplacementCoachID
                WHERE s.Status = 'SCHEDULED'
                  AND s.SessionDate >= CAST(GETDATE() AS DATE)
                  AND (
                      b.UnavailableBlockID IS NOT NULL
                      OR lo.OfferID IS NOT NULL
                  )
                ORDER BY s.SessionDate, ts.SlotIndex, s.PTSessionID
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ptSessionId", rs.getInt("PTSessionID"));
            item.put("ptRequestId", rs.getInt("PTRequestID"));
            item.put("customerId", rs.getInt("CustomerID"));
            item.put("customerName", rs.getString("CustomerName"));
            item.put("customerEmail", rs.getString("CustomerEmail"));
            item.put("customerPhone", rs.getString("CustomerPhone"));
            item.put("sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            item.put("timeSlotId", rs.getInt("TimeSlotID"));
            item.put("slotIndex", rs.getInt("SlotIndex"));
            item.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            item.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            item.put("unavailableBlockId", parseInteger(rs.getObject("UnavailableBlockID")));
            item.put("blockStartDate", rs.getDate("BlockStartDate") != null
                    ? dateToString(rs.getDate("BlockStartDate").toLocalDate())
                    : null);
            item.put("blockEndDate", rs.getDate("BlockEndDate") != null
                    ? dateToString(rs.getDate("BlockEndDate").toLocalDate())
                    : null);
            item.put("blockNote", rs.getString("BlockNote"));
            item.put("offerId", parseInteger(rs.getObject("OfferID")));
            item.put("offerStatus", rs.getString("OfferStatus"));
            item.put("offerNote", rs.getString("OfferNote"));
            item.put("replacementCoachId", parseInteger(rs.getObject("ReplacementCoachID")));
            item.put("replacementCoachName", rs.getString("ReplacementCoachName"));
            item.put("resolutionState", deriveExceptionResolutionState(
                    parseInteger(rs.getObject("OfferID")),
                    rs.getString("OfferStatus")));
            return item;
        }, coach.userId(), coach.userId());
        return Map.of("items", items);
    }

    private Map<String, Object> coachGetReplacementCoaches(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT c.CoachID, u.FullName, u.Email, u.Phone
                FROM dbo.Coaches c
                JOIN dbo.Users u ON u.UserID = c.CoachID
                WHERE u.IsActive = 1
                  AND c.CoachID <> ?
                ORDER BY u.FullName
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("coachId", rs.getInt("CoachID"));
            item.put("fullName", rs.getString("FullName"));
            item.put("email", rs.getString("Email"));
            item.put("phone", rs.getString("Phone"));
            return item;
        }, coach.userId());
        return Map.of("items", items);
    }

    @Transactional
    private Map<String, Object> coachCreateReplacementOffer(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");
        Map<String, Object> body = asMap(payload.get("body"));
        int replacementCoachId = requireInteger(body, "replacementCoachId");
        String note = asText(body.get("note"));
        if (replacementCoachId == coach.userId()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Replacement coach must be different from the primary coach.");
        }

        Map<String, Object> session = jdbcTemplate.query("""
                SELECT s.PTSessionID, s.CustomerID, s.SessionDate, s.TimeSlotID, s.Status, s.CoachID
                FROM dbo.PTSessions s
                WHERE s.PTSessionID = ?
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ptSessionId", rs.getInt("PTSessionID"));
            item.put("customerId", rs.getInt("CustomerID"));
            item.put("sessionDate", rs.getDate("SessionDate").toLocalDate());
            item.put("timeSlotId", rs.getInt("TimeSlotID"));
            item.put("status", rs.getString("Status"));
            item.put("coachId", rs.getInt("CoachID"));
            return item;
        }, sessionId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        if (!"SCHEDULED".equalsIgnoreCase(String.valueOf(session.get("status")))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only scheduled PT sessions can receive a replacement offer.");
        }
        if ((Integer) session.get("coachId") != coach.userId()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only the primary coach currently assigned to this session can issue a replacement offer.");
        }
        ensureSessionImpactedByActiveBlock(sessionId, coach.userId(), (LocalDate) session.get("sessionDate"),
                (Integer) session.get("timeSlotId"));
        requireCoachExists(replacementCoachId);
        if (!isCoachWeeklyAvailable(replacementCoachId, ((LocalDate) session.get("sessionDate")).getDayOfWeek().getValue(),
                (Integer) session.get("timeSlotId"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Replacement coach is not available for this slot.");
        }
        if (hasCoachConflict(replacementCoachId, (LocalDate) session.get("sessionDate"), (Integer) session.get("timeSlotId"),
                sessionId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Replacement coach already has another PT session in this slot.");
        }

        jdbcTemplate.update("""
                UPDATE dbo.PTSessionReplacementOffers
                SET Status = 'CANCELLED', UpdatedAt = SYSDATETIME()
                WHERE PTSessionID = ?
                  AND Status = 'PENDING_CUSTOMER'
                """, sessionId);

        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.PTSessionReplacementOffers
                        (PTSessionID, OriginalCoachID, ReplacementCoachID, Status, Note)
                    VALUES (?, ?, ?, 'PENDING_CUSTOMER', ?)
                    """, new String[] { "OfferID" });
            statement.setInt(1, sessionId);
            statement.setInt(2, coach.userId());
            statement.setInt(3, replacementCoachId);
            statement.setString(4, note);
            return statement;
        }, keyHolder);
        int offerId = keyHolder.getKey() != null ? keyHolder.getKey().intValue() : 0;

        notificationService.notifyUser(
                (Integer) session.get("customerId"),
                "PT_REPLACEMENT_OFFER",
                "Replacement coach offered",
                loadUserFullName(coach.userId()) + " offered a replacement coach for your PT session on "
                        + dateToString((LocalDate) session.get("sessionDate")) + ".",
                "/customer/coach-booking",
                sessionId,
                "PT_REPLACEMENT_OFFER_" + offerId);

        return Map.of(
                "offerId", offerId,
                "sessionId", sessionId,
                "status", "PENDING_CUSTOMER",
                "message", "Replacement coach offer sent to the customer.");
    }

    private Map<String, Object> coachCreateSessionNotes(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");
        String noteContent = requireText(((Map<?, ?>) payload.getOrDefault("body", Map.of())), "noteContent");

        requireSessionBelongsToCoach(sessionId, coach.userId());
        String sessionStatus = jdbcTemplate.queryForObject(
                "SELECT Status FROM dbo.PTSessions WHERE PTSessionID = ? AND CoachID = ?",
                String.class,
                sessionId,
                coach.userId());
        if (!"COMPLETED".equalsIgnoreCase(sessionStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Session not found or not completed. Only completed sessions can be used for notes.");
        }
        jdbcTemplate.update("INSERT INTO dbo.PTSessionNotes (PTSessionID, NoteContent) VALUES (?, ?)", sessionId,
                noteContent);
        return Map.of("ptSessionId", sessionId, "message", "Note added.");
    }

    private Map<String, Object> coachCancelSession(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");
        String reason = asText(((Map<?, ?>) payload.getOrDefault("body", Map.of())).get("cancelReason"));
        SessionNotificationContext session = loadSessionNotificationContext(sessionId);

        int updated = jdbcTemplate.update("""
                UPDATE dbo.PTSessions
                SET Status = 'CANCELLED', CancelReason = ?, UpdatedAt = SYSDATETIME()
                WHERE PTSessionID = ? AND CoachID = ? AND Status = 'SCHEDULED' AND SessionDate >= CAST(GETDATE() AS DATE)
                """, reason != null ? reason : "Cancelled by coach", sessionId, coach.userId());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Session not found, already cancelled, or cannot be cancelled.");
        }

        String resolvedReason = reason != null ? reason : "Cancelled by coach";
        notifyCoachCancelledSession(session, resolvedReason);
        return Map.of(
                "sessionId", sessionId,
                "status", "CANCELLED",
                "message", "Session cancelled successfully.");
    }

    private Map<String, Object> coachDeleteSession(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");

        // Verify session belongs to coach and is CANCELLED
        List<String> status = jdbcTemplate.query(
                "SELECT Status FROM dbo.PTSessions WHERE PTSessionID = ? AND CoachID = ?",
                (rs, i) -> rs.getString("Status"), sessionId, coach.userId());

        if (status.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found.");
        }

        if (!"CANCELLED".equalsIgnoreCase(status.get(0))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only cancelled sessions can be deleted.");
        }

        jdbcTemplate.update("DELETE FROM dbo.PTSessionNotes WHERE PTSessionID = ?", sessionId);
        jdbcTemplate.update("DELETE FROM dbo.PTSessions WHERE PTSessionID = ?", sessionId);

        return Map.of("sessionId", sessionId, "message", "Session deleted successfully.");
    }

    private Map<String, Object> coachCompleteSession(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");

        int updated = jdbcTemplate.update(
                "UPDATE dbo.PTSessions SET Status = 'COMPLETED', UpdatedAt = SYSDATETIME() WHERE PTSessionID = ? AND CoachID = ? AND Status = 'SCHEDULED'",
                sessionId, coach.userId());

        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Session not found, not yours, or not in SCHEDULED status.");
        }

        return Map.of("sessionId", sessionId, "status", "COMPLETED", "message", "Session marked as completed.");
    }

    private Map<String, Object> coachUpdateSessionNote(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int noteId = requireInteger(payload, "noteId");
        String noteContent = requireText(((Map<?, ?>) payload.getOrDefault("body", Map.of())), "noteContent");

        List<Integer> sessionIds = jdbcTemplate.query(
                "SELECT PTSessionID FROM dbo.PTSessionNotes WHERE PTSessionNoteID = ?",
                (rs, i) -> rs.getInt("PTSessionID"), noteId);
        if (sessionIds.isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found.");
        int sessionId = sessionIds.get(0);
        requireSessionBelongsToCoach(sessionId, coach.userId());
        jdbcTemplate.update(
                "UPDATE dbo.PTSessionNotes SET NoteContent = ?, UpdatedAt = SYSDATETIME() WHERE PTSessionNoteID = ?",
                noteContent, noteId);
        return Map.of("noteId", noteId, "message", "Note updated.");
    }

    private Map<String, Object> coachGetCustomers(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT DISTINCT u.UserID AS CustomerID, u.FullName, u.Email, u.Phone, u.AvatarUrl,
                               (SELECT COUNT(*) FROM dbo.PTSessions s WHERE s.CoachID = ? AND s.CustomerID = u.UserID AND s.Status IN ('SCHEDULED','COMPLETED')) AS SessionCount
                        FROM dbo.PTSessions s
                        JOIN dbo.Users u ON u.UserID = s.CustomerID
                        WHERE s.CoachID = ?
                        ORDER BY u.FullName
                        """,
                coachCustomersRowMapper(), coach.userId(), coach.userId());
        return Map.of("items", items);
    }

    private Map<String, Object> coachGetCustomerDetail(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int customerId = requireInteger(payload, "customerId");
        requireCoachHasCustomer(coach.userId(), customerId);

        Map<String, Object> customer = jdbcTemplate.query("""
                SELECT u.UserID AS CustomerID, u.FullName, u.Email, u.Phone, u.AvatarUrl, c.DateOfBirth, c.Gender
                FROM dbo.Users u
                JOIN dbo.Customers c ON c.CustomerID = u.UserID
                WHERE u.UserID = ?
                """, customerDetailRowMapper(), customerId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found."));

        List<Map<String, Object>> health = jdbcTemplate.query("""
                SELECT HeightCm, WeightKg, BMI, UpdatedAt FROM dbo.CustomerHealthCurrent WHERE CustomerID = ?
                """, (rs, i) -> Map.<String, Object>of(
                "heightCm", rs.getBigDecimal("HeightCm"),
                "weightKg", rs.getBigDecimal("WeightKg"),
                "bmi", rs.getBigDecimal("BMI"),
                "updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt"))), customerId);
        customer.put("health", health.isEmpty() ? Map.of() : health.get(0));

        Integer sessionCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM dbo.PTSessions WHERE CoachID = ? AND CustomerID = ? AND Status IN ('SCHEDULED','COMPLETED')
                        """,
                Integer.class, coach.userId(), customerId);
        customer.put("sessionCount", sessionCount != null ? sessionCount : 0);
        return customer;
    }

    private Map<String, Object> coachGetCustomerHistory(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int customerId = requireInteger(payload, "customerId");
        requireCoachHasCustomer(coach.userId(), customerId);

        List<Map<String, Object>> sessions = jdbcTemplate.query("""
                SELECT s.PTSessionID, s.SessionDate, s.Status, ts.SlotIndex, ts.StartTime, ts.EndTime
                FROM dbo.PTSessions s
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                WHERE s.CoachID = ? AND s.CustomerID = ?
                ORDER BY s.SessionDate DESC, ts.SlotIndex DESC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            m.put("status", rs.getString("Status"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            java.sql.Time st = rs.getTime("StartTime");
            java.sql.Time et = rs.getTime("EndTime");
            m.put("startTime", st != null ? st.toString() : null);
            m.put("endTime", et != null ? et.toString() : null);
            return m;
        }, coach.userId(), customerId);

        List<Map<String, Object>> healthHistory = jdbcTemplate.query(
                """
                        SELECT HeightCm, WeightKg, BMI, RecordedAt FROM dbo.CustomerHealthHistory WHERE CustomerID = ? ORDER BY RecordedAt DESC
                        """,
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("heightCm", rs.getBigDecimal("HeightCm"));
                    m.put("weightKg", rs.getBigDecimal("WeightKg"));
                    m.put("bmi", rs.getBigDecimal("BMI"));
                    m.put("recordedAt", timestampToIso(rs.getTimestamp("RecordedAt")));
                    return m;
                }, customerId);

        List<Map<String, Object>> notes = jdbcTemplate.query("""
                SELECT n.PTSessionNoteID, n.PTSessionID, n.NoteContent, n.CreatedAt, n.UpdatedAt
                FROM dbo.PTSessionNotes n
                JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
                WHERE s.CoachID = ? AND s.CustomerID = ?
                ORDER BY n.CreatedAt DESC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("noteId", rs.getInt("PTSessionNoteID"));
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("noteContent", rs.getString("NoteContent"));
            m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            m.put("updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt")));
            return m;
        }, coach.userId(), customerId);

        return Map.of("sessions", sessions, "healthHistory", healthHistory, "notes", notes);
    }

    private Map<String, Object> coachUpdateCustomerProgress(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int customerId = requireInteger(payload, "customerId");
        requireCoachHasCustomer(coach.userId(), customerId);

        Map<?, ?> body = asMap(payload.get("body"));
        java.math.BigDecimal heightCm = parseDecimal(body.get("heightCm"));
        java.math.BigDecimal weightKg = parseDecimal(body.get("weightKg"));
        if (heightCm == null || weightKg == null || heightCm.doubleValue() <= 0 || weightKg.doubleValue() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "heightCm and weightKg are required and must be positive.");
        }
        jdbcTemplate.update(
                "INSERT INTO dbo.CustomerHealthHistory (CustomerID, HeightCm, WeightKg) VALUES (?, ?, ?)",
                customerId, heightCm, weightKg);

        jdbcTemplate.update(
                """
                        IF EXISTS (SELECT 1 FROM dbo.CustomerHealthCurrent WHERE CustomerID = ?)
                            UPDATE dbo.CustomerHealthCurrent SET HeightCm = ?, WeightKg = ?, UpdatedAt = SYSDATETIME() WHERE CustomerID = ?
                        ELSE
                            INSERT INTO dbo.CustomerHealthCurrent (CustomerID, HeightCm, WeightKg) VALUES (?, ?, ?)
                        """,
                customerId, heightCm, weightKg,
                customerId, customerId, heightCm, weightKg);

        return Map.of("customerId", customerId, "message", "Progress recorded and current status updated.");
    }

    private Map<String, Object> coachGetFeedback(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT cf.CoachFeedbackID, cf.PTSessionID, cf.Rating, cf.Comment, cf.CreatedAt, u.FullName AS CustomerName
                        FROM dbo.CoachFeedback cf
                        JOIN dbo.Users u ON u.UserID = cf.CustomerID
                        WHERE cf.CoachID = ?
                        ORDER BY cf.CreatedAt DESC
                        """,
                feedbackRowMapper(), coach.userId());
        return Map.of("items", items);
    }

    private Map<String, Object> coachGetFeedbackAverage(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        Double avg = jdbcTemplate.queryForObject(
                "SELECT AVG(CAST(Rating AS FLOAT)) FROM dbo.CoachFeedback WHERE CoachID = ?", Double.class,
                coach.userId());
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM dbo.CoachFeedback WHERE CoachID = ?",
                Integer.class, coach.userId());
        return Map.of("averageRating", avg != null ? Math.round(avg * 100.0) / 100.0 : 0, "totalReviews",
                count != null ? count : 0);
    }

    // ---------- Admin ----------

    private Map<String, Object> adminGetCoaches(Map<String, Object> payload) {
        requireAdmin(payload);
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT c.CoachID, u.FullName, u.Email, u.Phone, c.ExperienceYears, c.Bio,
                               COALESCE(agg.AvgRating, 0) AS AvgRating, COALESCE(agg.ReviewCount, 0) AS ReviewCount,
                               (SELECT COUNT(DISTINCT s.CustomerID) FROM dbo.PTSessions s WHERE s.CoachID = c.CoachID AND s.Status IN ('SCHEDULED','COMPLETED')) AS StudentCount
                        FROM dbo.Coaches c
                        JOIN dbo.Users u ON u.UserID = c.CoachID
                        LEFT JOIN (SELECT CoachID, AVG(CAST(Rating AS FLOAT)) AS AvgRating, COUNT(*) AS ReviewCount FROM dbo.CoachFeedback GROUP BY CoachID) agg ON agg.CoachID = c.CoachID
                        ORDER BY u.FullName
                        """,
                adminCoachListRowMapper());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        return result;
    }

    private Map<String, Object> adminGetCoachDetail(Map<String, Object> payload) {
        requireAdmin(payload);
        int coachId = requireInteger(payload, "coachId");
        Map<String, Object> coach = jdbcTemplate
                .query("""
                        SELECT c.CoachID, u.FullName, u.Email, u.Phone, u.AvatarUrl, c.DateOfBirth, c.Gender, c.ExperienceYears, c.Bio,
                               COALESCE(agg.AvgRating, 0) AS AvgRating, COALESCE(agg.ReviewCount, 0) AS ReviewCount
                        FROM dbo.Coaches c
                        JOIN dbo.Users u ON u.UserID = c.CoachID
                        LEFT JOIN (SELECT CoachID, AVG(CAST(Rating AS FLOAT)) AS AvgRating, COUNT(*) AS ReviewCount FROM dbo.CoachFeedback GROUP BY CoachID) agg ON agg.CoachID = c.CoachID
                        WHERE c.CoachID = ?
                        """,
                        coachDetailRowMapper(), coachId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found."));
        Integer studentCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT CustomerID) FROM dbo.PTSessions WHERE CoachID = ? AND Status IN ('SCHEDULED','COMPLETED')",
                Integer.class, coachId);
        coach.put("studentCount", studentCount != null ? studentCount : 0);
        return coach;
    }

    private Map<String, Object> adminUpdateCoachProfile(Map<String, Object> payload) {
        requireAdmin(payload);
        int coachId = requireInteger(payload, "coachId");
        Map<String, Object> body = asMap(payload.get("body"));
        String fullName = asText(body.get("fullName"));
        String phone = asText(body.get("phone"));
        Integer experienceYears = parseInteger(body.get("experienceYears"));
        String bio = asText(body.get("bio"));
        String dateOfBirth = asText(body.get("dateOfBirth"));
        String gender = asText(body.get("gender"));
        Boolean acceptingCustomerRequests = body.get("acceptingCustomerRequests") instanceof Boolean flag ? flag : null;

        Integer coachCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM dbo.Coaches WHERE CoachID = ?",
                Integer.class,
                coachId);
        if (coachCount == null || coachCount == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found.");
        }
        if (body.containsKey("fullName") && fullName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach full name is required.");
        }
        if (body.containsKey("phone") && phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach phone number is required.");
        }
        if (body.containsKey("bio") && bio == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach bio is required.");
        }
        if (experienceYears != null && experienceYears < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Years of experience cannot be negative.");
        }

        LocalDate parsedDateOfBirth = null;
        if (dateOfBirth != null) {
            try {
                parsedDateOfBirth = LocalDate.parse(dateOfBirth);
            } catch (Exception exception) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Date of birth must use YYYY-MM-DD format.");
            }
        }

        if (fullName != null)
            jdbcTemplate.update("UPDATE dbo.Users SET FullName = ?, UpdatedAt = SYSDATETIME() WHERE UserID = ?",
                    fullName, coachId);
        if (phone != null)
            jdbcTemplate.update("UPDATE dbo.Users SET Phone = ?, UpdatedAt = SYSDATETIME() WHERE UserID = ?", phone,
                    coachId);
        String existingBio = jdbcTemplate.queryForObject(
                "SELECT Bio FROM dbo.Coaches WHERE CoachID = ?",
                String.class,
                coachId);
        boolean acceptingCustomers = acceptingCustomerRequests != null
                ? acceptingCustomerRequests
                : extractCoachMatchAvailability(existingBio);
        String persistedBio = bio != null
                ? mergeCoachAvailabilityFlagIntoBio(bio, acceptingCustomers)
                : (acceptingCustomerRequests != null
                        ? mergeCoachAvailabilityFlagIntoBio(existingBio, acceptingCustomers)
                        : null);
        int updatedRows = jdbcTemplate.update("""
                UPDATE dbo.Coaches SET ExperienceYears = COALESCE(?, ExperienceYears), Bio = COALESCE(?, Bio),
                       DateOfBirth = CASE WHEN ? IS NOT NULL THEN ? ELSE DateOfBirth END,
                       Gender = COALESCE(?, Gender)
                WHERE CoachID = ?
                """,
                experienceYears,
                persistedBio,
                parsedDateOfBirth == null ? null : java.sql.Date.valueOf(parsedDateOfBirth),
                parsedDateOfBirth == null ? null : java.sql.Date.valueOf(parsedDateOfBirth),
                gender,
                coachId);
        if (updatedRows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found.");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("coachId", coachId);
        result.put("message", "Profile updated.");
        return result;
    }

    private Map<String, Object> adminGetCoachPerformance(Map<String, Object> payload) {
        requireAdmin(payload);
        int coachId = requireInteger(payload, "coachId");
        Double avg = jdbcTemplate.queryForObject(
                "SELECT AVG(CAST(Rating AS FLOAT)) FROM dbo.CoachFeedback WHERE CoachID = ?", Double.class, coachId);
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM dbo.CoachFeedback WHERE CoachID = ?",
                Integer.class, coachId);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT CoachFeedbackID, PTSessionID, Rating, Comment, CreatedAt
                FROM dbo.CoachFeedback WHERE CoachID = ? ORDER BY CreatedAt DESC
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("coachFeedbackId", rs.getInt("CoachFeedbackID"));
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("rating", rs.getInt("Rating"));
            m.put("comment", rs.getString("Comment"));
            m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            return m;
        }, coachId);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("coachId", coachId);
        res.put("averageRating", avg != null ? Math.round(avg * 100.0) / 100.0 : 0);
        res.put("totalReviews", count != null ? count : 0);
        res.put("reviews", items);
        return res;
    }

    private Map<String, Object> adminGetCoachStudents(Map<String, Object> payload) {
        requireAdmin(payload);
        int coachId = requireInteger(payload, "coachId");
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT u.UserID AS CustomerID, u.FullName, u.Email, u.Phone,
                               SUM(CASE WHEN s.Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedSessions,
                               MAX(CASE WHEN s.Status = 'COMPLETED' THEN s.SessionDate ELSE NULL END) AS LastSessionDate
                        FROM dbo.PTSessions s
                        JOIN dbo.Users u ON u.UserID = s.CustomerID
                        WHERE s.CoachID = ?
                        GROUP BY u.UserID, u.FullName, u.Email, u.Phone
                        ORDER BY CompletedSessions DESC, u.FullName
                        """,
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("customerId", rs.getInt("CustomerID"));
                    m.put("fullName", rs.getString("FullName"));
                    m.put("email", rs.getString("Email"));
                    m.put("phone", rs.getString("Phone"));
                    m.put("completedSessions", rs.getInt("CompletedSessions"));
                    java.sql.Date lastDate = rs.getDate("LastSessionDate");
                    m.put("lastSession", lastDate != null ? lastDate.toLocalDate().format(DATE_FORMAT) : "N/A");
                    return m;
                },
                coachId);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("coachId", coachId);
        res.put("items", items);
        return res;
    }

    private List<RequestedSlot> normalizeRequestedSlots(List<Map<String, Object>> slots) {
        List<RequestedSlot> normalized = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Map<Integer, Integer> dayToSlot = new HashMap<>();
        for (Map<String, Object> slot : slots) {
            int dayOfWeek = requireInteger(slot, "dayOfWeek");
            int timeSlotId = requireInteger(slot, "timeSlotId");
            if (dayOfWeek < 1 || dayOfWeek > 7) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dayOfWeek must be 1-7.");
            }
            Integer existingTimeSlotId = dayToSlot.putIfAbsent(dayOfWeek, timeSlotId);
            if (existingTimeSlotId != null && existingTimeSlotId != timeSlotId) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Only one recurring slot can be selected per weekday.");
            }
            String key = dayOfWeek + "-" + timeSlotId;
            if (seen.add(key)) {
                normalized.add(new RequestedSlot(dayOfWeek, timeSlotId));
            }
        }
        return normalized;
    }

    private List<Map<String, Object>> toRequestedSlotMaps(List<RequestedSlot> requestedSlots) {
        List<Map<String, Object>> normalizedSlots = new ArrayList<>();
        for (RequestedSlot slot : requestedSlots) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("dayOfWeek", slot.dayOfWeek());
            item.put("timeSlotId", slot.timeSlotId());
            normalizedSlots.add(item);
        }
        return normalizedSlots;
    }

    private MatchSummary evaluateCoachMatch(int coachId, LocalDate startDate, LocalDate endDate,
            List<RequestedSlot> requestedSlots) {
        List<Map<String, Object>> weeklyAvailability = loadWeeklyAvailability(coachId);
        Set<String> availablePairs = new HashSet<>();
        Map<Integer, List<Integer>> availableSlotsByDay = new HashMap<>();
        for (Map<String, Object> item : weeklyAvailability) {
            int dayOfWeek = requireInteger(item, "dayOfWeek");
            int timeSlotId = requireInteger(item, "timeSlotId");
            availablePairs.add(dayOfWeek + "-" + timeSlotId);
            availableSlotsByDay.computeIfAbsent(dayOfWeek, ignored -> new ArrayList<>()).add(timeSlotId);
        }
        for (List<Integer> daySlots : availableSlotsByDay.values()) {
            daySlots.sort(Integer::compareTo);
        }

        List<Map<String, Object>> booked = jdbcTemplate.query(
                """
                        SELECT DayOfWeek, TimeSlotID
                        FROM dbo.PTSessions
                        WHERE CoachID = ? AND SessionDate >= ? AND SessionDate <= ? AND Status IN ('SCHEDULED','COMPLETED')
                        """,
                (rs, i) -> Map.of("dayOfWeek", rs.getInt("DayOfWeek"), "timeSlotId", rs.getInt("TimeSlotID")),
                coachId, startDate, endDate);
        Set<String> bookedPairs = new HashSet<>();
        for (Map<String, Object> item : booked) {
            bookedPairs.add(requireInteger(item, "dayOfWeek") + "-" + requireInteger(item, "timeSlotId"));
        }

        int exactMatched = 0;
        int matched = 0;
        int bookedConflicts = 0;
        List<Map<String, Object>> unavailable = new ArrayList<>();
        List<Map<String, Object>> alternativeSlots = new ArrayList<>();
        List<Map<String, Object>> resolvedSlots = new ArrayList<>();
        for (RequestedSlot slot : requestedSlots) {
            String key = slot.dayOfWeek() + "-" + slot.timeSlotId();
            boolean exactWeeklyAvailable = availablePairs.contains(key);
            boolean exactBooked = bookedPairs.contains(key);
            if (exactWeeklyAvailable && !exactBooked) {
                exactMatched++;
                matched++;
                resolvedSlots.add(Map.of(
                        "dayOfWeek", slot.dayOfWeek(),
                        "timeSlotId", slot.timeSlotId(),
                        "requestedTimeSlotId", slot.timeSlotId(),
                        "exactMatch", true));
                continue;
            }

            List<Integer> sameDayAvailable = availableSlotsByDay.getOrDefault(slot.dayOfWeek(), List.of());
            List<Integer> freeTimeSlotIds = sameDayAvailable.stream()
                    .filter(candidate -> !bookedPairs.contains(slot.dayOfWeek() + "-" + candidate))
                    .toList();
            if (!freeTimeSlotIds.isEmpty()) {
                int fallbackTimeSlotId = freeTimeSlotIds.getFirst();
                matched++;
                alternativeSlots.add(Map.of(
                        "dayOfWeek", slot.dayOfWeek(),
                        "requestedTimeSlotId", slot.timeSlotId(),
                        "timeSlotId", fallbackTimeSlotId,
                        "freeTimeSlotIds", freeTimeSlotIds,
                        "reason", exactBooked ? "BOOKED_IN_RANGE" : "DIFFERENT_SLOT_AVAILABLE"));
                resolvedSlots.add(Map.of(
                        "dayOfWeek", slot.dayOfWeek(),
                        "timeSlotId", fallbackTimeSlotId,
                        "requestedTimeSlotId", slot.timeSlotId(),
                        "exactMatch", false));
                continue;
            }

            String reason = exactBooked ? "BOOKED_IN_RANGE" : "NO_WEEKLY_AVAILABILITY";
            if (exactBooked) {
                bookedConflicts++;
            }
            unavailable.add(Map.of(
                    "dayOfWeek", slot.dayOfWeek(),
                    "timeSlotId", slot.timeSlotId(),
                    "reason", reason));
        }

        return new MatchSummary(exactMatched, matched, bookedConflicts, unavailable, alternativeSlots, resolvedSlots);
    }

    // ---------- Helpers ----------

    private AuthService.AuthContext requireCustomer(Map<String, Object> payload) {
        AuthService.AuthContext ctx = requireAuth(payload);
        if (!"CUSTOMER".equalsIgnoreCase(ctx.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only customer can perform this action.");
        }
        return ctx;
    }

    private AuthService.AuthContext requireCoach(Map<String, Object> payload) {
        AuthService.AuthContext ctx = requireAuth(payload);
        if (!"COACH".equalsIgnoreCase(ctx.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only coach can perform this action.");
        }
        return ctx;
    }

    private AuthService.AuthContext requireAdmin(Map<String, Object> payload) {
        AuthService.AuthContext ctx = requireAuth(payload);
        if (!"ADMIN".equalsIgnoreCase(ctx.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admin can perform this action.");
        }
        return ctx;
    }

    private AuthService.AuthContext requireAuth(Map<String, Object> payload) {
        String authorizationHeader = asText(payload.get("authorizationHeader"));
        return authService.requireAuthContext(authorizationHeader);
    }

    private MembershipForPt findActiveMembershipForPt(int customerId, LocalDate startDate) {
        return jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.EndDate,
                    mp.AllowsCoachBooking
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ?
                  AND cm.Status = 'ACTIVE'
                  AND cm.StartDate <= ?
                  AND cm.EndDate >= ?
                  AND UPPER(mp.PlanType) IN ('GYM_PLUS_COACH', 'GYM_COACH')
                  AND mp.AllowsCoachBooking = 1
                ORDER BY cm.EndDate ASC, cm.CustomerMembershipID ASC
                """,
                (rs, i) -> new MembershipForPt(
                        rs.getInt("CustomerMembershipID"),
                        rs.getBoolean("AllowsCoachBooking"),
                        rs.getDate("EndDate").toLocalDate()),
                customerId, startDate, startDate).stream()
                .findFirst()
                .orElse(new MembershipForPt(null, false, null));
    }

    private MembershipForPt requireValidMembershipForPt(int customerId, int customerMembershipId,
            LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.EndDate,
                    mp.AllowsCoachBooking
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerMembershipID = ?
                  AND cm.CustomerID = ?
                  AND cm.Status = 'ACTIVE'
                  AND cm.StartDate <= ?
                  AND cm.EndDate >= ?
                  AND UPPER(mp.PlanType) IN ('GYM_PLUS_COACH', 'GYM_COACH')
                  AND mp.AllowsCoachBooking = 1
                """,
                (rs, i) -> new MembershipForPt(
                        rs.getInt("CustomerMembershipID"),
                        rs.getBoolean("AllowsCoachBooking"),
                        rs.getDate("EndDate").toLocalDate()),
                customerMembershipId, customerId, startDate, endDate).stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Membership ID is invalid, inactive, or does not allow PT booking. Leave it empty to let the system use your active membership automatically."));
    }

    private LocalDate resolveMinimumBookingStartDate(LocalDate requestDate) {
        return requestDate.plusDays(1);
    }

    private LocalDate nextMondayOnOrAfter(LocalDate date) {
        int daysUntilMonday = Math.floorMod(8 - date.getDayOfWeek().getValue(), 7);
        return date.plusDays(daysUntilMonday);
    }

    private LocalDate nextMondayAfter(LocalDate date) {
        int daysUntilMonday = 8 - date.getDayOfWeek().getValue();
        return date.plusDays(daysUntilMonday);
    }

    private void requireCoachExists(int coachId) {
        List<Integer> c = jdbcTemplate.query("SELECT 1 FROM dbo.Coaches WHERE CoachID = ?", (rs, i) -> 1, coachId);
        if (c.isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found.");
    }

    private void requireSessionBelongsToCoach(int sessionId, int coachId) {
        List<Integer> c = jdbcTemplate.query("SELECT 1 FROM dbo.PTSessions WHERE PTSessionID = ? AND CoachID = ?",
                (rs, i) -> 1, sessionId, coachId);
        if (c.isEmpty())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session does not belong to this coach.");
    }

    private void requireCoachHasCustomer(int coachId, int customerId) {
        List<Integer> c = jdbcTemplate.query("SELECT 1 FROM dbo.PTSessions WHERE CoachID = ? AND CustomerID = ?",
                (rs, i) -> 1, coachId, customerId);
        if (c.isEmpty())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Customer is not your student.");
    }

    private int requireInteger(Map<?, ?> map, String key) {
        Integer v = parseInteger(map.get(key));
        if (v == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " is required.");
        return v;
    }

    private String requireText(Map<?, ?> map, String key) {
        String v = asText(map.get(key));
        if (v == null || v.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " is required.");
        return v;
    }

    private java.math.BigDecimal parseDecimal(Object value) {
        if (value == null)
            return null;
        if (value instanceof java.math.BigDecimal d)
            return d;
        if (value instanceof Number n)
            return java.math.BigDecimal.valueOf(n.doubleValue());
        try {
            return new java.math.BigDecimal(value.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object payload) {
        if (payload instanceof Map<?, ?> map)
            return (Map<String, Object>) map;
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        if (value instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return List.of();
    }

    private String asText(Object value) {
        if (value == null)
            return null;
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private Integer parseInteger(Object value) {
        if (value == null)
            return null;
        if (value instanceof Integer i)
            return i;
        if (value instanceof Number n)
            return n.intValue();
        try {
            String s = value.toString().trim();
            if (s.isEmpty())
                return null;
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isCoachWeeklyAvailable(int coachId, int dayOfWeek, int timeSlotId) {
        Integer totalRows = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM dbo.CoachWeeklyAvailability
                        WHERE CoachID = ?
                        """,
                Integer.class, coachId);
        if (totalRows == null || totalRows == 0) {
            Integer slotCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM dbo.TimeSlots WHERE TimeSlotID = ?",
                    Integer.class, timeSlotId);
            return dayOfWeek >= 1 && dayOfWeek <= 7 && slotCount != null && slotCount > 0;
        }

        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM dbo.CoachWeeklyAvailability
                        WHERE CoachID = ? AND DayOfWeek = ? AND TimeSlotID = ? AND IsAvailable = 1
                        """,
                Integer.class, coachId, dayOfWeek, timeSlotId);
        return count != null && count > 0;
    }

    private boolean hasPtRequestDenyReasonColumn() {
        Integer exists = jdbcTemplate.queryForObject(
                "SELECT CASE WHEN COL_LENGTH('dbo.PTRecurringRequests', 'DenyReason') IS NULL THEN 0 ELSE 1 END",
                Integer.class);
        return exists != null && exists == 1;
    }

    private boolean hasCoachConflict(int coachId, LocalDate date, int timeSlotId, int excludedSessionId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM dbo.PTSessions
                        WHERE CoachID = ? AND SessionDate = ? AND TimeSlotID = ?
                          AND Status IN ('SCHEDULED','COMPLETED')
                          AND PTSessionID <> ?
                        """,
                Integer.class, coachId, date, timeSlotId, excludedSessionId);
        return count != null && count > 0;
    }

    private boolean createScheduledSessionIfMissing(int ptRequestId, int customerId, int coachId, LocalDate date,
            int dayOfWeek, int timeSlotId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM dbo.PTSessions
                WHERE PTRequestID = ? AND SessionDate = ? AND TimeSlotID = ?
                """, Integer.class, ptRequestId, date, timeSlotId);
        if (count != null && count > 0) {
            return false;
        }
        try {
            jdbcTemplate.update(
                    """
                            INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
                            VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')
                            """,
                    ptRequestId, customerId, coachId, date, dayOfWeek, timeSlotId);
            return true;
        } catch (DataAccessException ignored) {
            return false;
        }
    }

    private int regenerateFuturePtSessions(int ptRequestId, int customerId, int coachId, LocalDate startDate,
            LocalDate endDate, List<Map<String, Object>> slots, List<Map<String, Object>> preservedFutureSessions) {
        Set<String> blockedKeys = new HashSet<>();
        for (Map<String, Object> preserved : preservedFutureSessions) {
            LocalDate sessionDate = (LocalDate) preserved.get("sessionDate");
            Integer timeSlotId = parseInteger(preserved.get("timeSlotId"));
            if (sessionDate != null && timeSlotId != null) {
                blockedKeys.add(sessionDate + "|" + timeSlotId);
            }
        }
        int created = 0;
        for (LocalDate current = startDate; !current.isAfter(endDate); current = current.plusDays(1)) {
            int dayOfWeek = current.getDayOfWeek().getValue();
            for (Map<String, Object> slot : slots) {
                Integer slotDay = parseInteger(slot.get("dayOfWeek"));
                Integer timeSlotId = parseInteger(slot.get("timeSlotId"));
                if (slotDay == null || timeSlotId == null || slotDay != dayOfWeek) {
                    continue;
                }
                if (blockedKeys.contains(current + "|" + timeSlotId)) {
                    continue;
                }
                if (createScheduledSessionIfMissing(ptRequestId, customerId, coachId, current, dayOfWeek, timeSlotId)) {
                    created++;
                }
            }
        }
        return created;
    }

    private void enforceSessionCutoff(LocalDate sessionDate, int timeSlotId) {
        LocalTime startTime = loadTimeSlotStartTime(timeSlotId);
        LocalDateTime sessionStart = LocalDateTime.of(sessionDate, startTime);
        if (LocalDateTime.now().plusHours(SELF_SERVICE_RESCHEDULE_CUTOFF_HOURS).isAfter(sessionStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "PT sessions can only be changed more than 12 hours before the session starts.");
        }
    }

    private LocalTime loadTimeSlotStartTime(int timeSlotId) {
        java.sql.Time startTime = jdbcTemplate.queryForObject("""
                SELECT TOP (1) StartTime
                FROM dbo.TimeSlots
                WHERE TimeSlotID = ?
                """, java.sql.Time.class, timeSlotId);
        if (startTime == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time slot was not found.");
        }
        return startTime.toLocalTime();
    }

    private void requireTimeSlotExists(int timeSlotId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dbo.TimeSlots WHERE TimeSlotID = ?",
                Integer.class, timeSlotId);
        if (count == null || count == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time slot was not found.");
        }
    }

    private boolean hasPendingReplacementOffer(int sessionId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM dbo.PTSessionReplacementOffers
                WHERE PTSessionID = ? AND Status = 'PENDING_CUSTOMER'
                """, Integer.class, sessionId);
        return count != null && count > 0;
    }

    private void attachReplacementOffers(int customerId, List<Map<String, Object>> sessions) {
        for (Map<String, Object> session : sessions) {
            attachReplacementOffer(customerId, session);
        }
    }

    private void attachReplacementOffer(int customerId, Map<String, Object> session) {
        Integer sessionId = parseInteger(session.get("ptSessionId"));
        if (sessionId == null) {
            return;
        }
        Map<String, Object> offer = jdbcTemplate.query("""
                SELECT TOP (1)
                    o.OfferID,
                    o.Status,
                    o.Note,
                    o.ReplacementCoachID,
                    replacementCoach.FullName AS ReplacementCoachName,
                    o.OriginalCoachID,
                    originalCoach.FullName AS OriginalCoachName,
                    o.CreatedAt,
                    s.SessionDate,
                    s.TimeSlotID
                FROM dbo.PTSessionReplacementOffers o
                JOIN dbo.PTSessions s ON s.PTSessionID = o.PTSessionID
                JOIN dbo.Users replacementCoach ON replacementCoach.UserID = o.ReplacementCoachID
                JOIN dbo.Users originalCoach ON originalCoach.UserID = o.OriginalCoachID
                WHERE o.PTSessionID = ?
                  AND s.CustomerID = ?
                ORDER BY o.CreatedAt DESC, o.OfferID DESC
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("offerId", rs.getInt("OfferID"));
            item.put("status", rs.getString("Status"));
            item.put("note", rs.getString("Note"));
            item.put("replacementCoachId", rs.getInt("ReplacementCoachID"));
            item.put("replacementCoachName", rs.getString("ReplacementCoachName"));
            item.put("originalCoachId", rs.getInt("OriginalCoachID"));
            item.put("originalCoachName", rs.getString("OriginalCoachName"));
            item.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            item.put("sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            item.put("timeSlotId", rs.getInt("TimeSlotID"));
            return item;
        }, sessionId, customerId).stream().findFirst().orElse(null);
        if (offer != null) {
            session.put("replacementOffer", offer);
        }
    }

    private Map<String, Object> loadPendingReplacementOfferForCustomer(int sessionId, int customerId) {
        return jdbcTemplate.query("""
                SELECT TOP (1)
                    o.OfferID,
                    o.OriginalCoachID,
                    o.ReplacementCoachID,
                    s.SessionDate,
                    s.TimeSlotID
                FROM dbo.PTSessionReplacementOffers o
                JOIN dbo.PTSessions s ON s.PTSessionID = o.PTSessionID
                WHERE o.PTSessionID = ?
                  AND s.CustomerID = ?
                  AND o.Status = 'PENDING_CUSTOMER'
                ORDER BY o.CreatedAt DESC, o.OfferID DESC
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("offerId", rs.getInt("OfferID"));
            item.put("originalCoachId", rs.getInt("OriginalCoachID"));
            item.put("replacementCoachId", rs.getInt("ReplacementCoachID"));
            item.put("sessionDate", rs.getDate("SessionDate").toLocalDate());
            item.put("timeSlotId", rs.getInt("TimeSlotID"));
            return item;
        }, sessionId, customerId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No pending replacement offer was found for this PT session."));
    }

    private void ensureSessionImpactedByActiveBlock(int sessionId, int coachId, LocalDate sessionDate, int timeSlotId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM dbo.CoachUnavailableBlocks
                WHERE CoachID = ?
                  AND IsActive = 1
                  AND ? BETWEEN StartDate AND EndDate
                  AND (TimeSlotID IS NULL OR TimeSlotID = ?)
                """, Integer.class, coachId, sessionDate, timeSlotId);
        if (count == null || count == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Create an unavailable block before issuing a replacement offer for this PT session.");
        }
    }

    private int countImpactedSessionsForBlock(int coachId, LocalDate startDate, LocalDate endDate, Integer timeSlotId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM dbo.PTSessions
                WHERE CoachID = ?
                  AND Status = 'SCHEDULED'
                  AND SessionDate BETWEEN ? AND ?
                  AND (? IS NULL OR TimeSlotID = ?)
                """, Integer.class, coachId, startDate, endDate, timeSlotId, timeSlotId);
        return count == null ? 0 : count;
    }

    private String deriveExceptionResolutionState(Integer offerId, String offerStatus) {
        if (offerId == null) {
            return "NEEDS_ACTION";
        }
        String normalized = offerStatus == null ? "" : offerStatus.toUpperCase();
        return switch (normalized) {
            case "PENDING_CUSTOMER" -> "OFFER_PENDING";
            case "ACCEPTED" -> "OFFER_ACCEPTED";
            case "DECLINED" -> "OFFER_DECLINED";
            default -> "NEEDS_ACTION";
        };
    }

    private Map<Integer, Map<String, Object>> loadTimeSlotMap() {
        Map<Integer, Map<String, Object>> map = new HashMap<>();
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT TimeSlotID, SlotIndex, StartTime, EndTime
                FROM dbo.TimeSlots
                ORDER BY SlotIndex
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            m.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            m.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            return m;
        });
        for (Map<String, Object> row : rows) {
            map.put(requireInteger(row, "timeSlotId"), row);
        }
        return map;
    }

    private String encodeRescheduleRequest(LocalDate date, int timeSlotId, String note) {
        String safeNote = note == null ? "" : note.replace("|", "/");
        return RESCHEDULE_REQUEST_PREFIX + dateToString(date) + "|" + timeSlotId + "|" + safeNote;
    }

    private String encodeRescheduleDenied(LocalDate date, int timeSlotId, String note) {
        String safeNote = note == null ? "" : note.replace("|", "/");
        return RESCHEDULE_DENIED_PREFIX + dateToString(date) + "|" + timeSlotId + "|" + safeNote;
    }

    private RescheduleMeta parseRescheduleMeta(String value) {
        if (value == null)
            return null;
        String state;
        if (value.startsWith(RESCHEDULE_REQUEST_PREFIX)) {
            state = "PENDING";
        } else if (value.startsWith(RESCHEDULE_DENIED_PREFIX)) {
            state = "DENIED";
        } else {
            return null;
        }

        String[] parts = value.split("\\|", -1);
        if (parts.length < 3) {
            return null;
        }
        try {
            LocalDate requestedDate = LocalDate.parse(parts[1]);
            Integer requestedTimeSlotId = parseInteger(parts[2]);
            if (requestedTimeSlotId == null) {
                return null;
            }
            String note = parts.length >= 4 ? parts[3] : null;
            return new RescheduleMeta(state, requestedDate, requestedTimeSlotId, note);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String dateToString(LocalDate d) {
        return d == null ? null : d.format(DATE_FORMAT);
    }

    private String timestampToIso(Timestamp t) {
        return t == null ? null : t.toInstant().toString();
    }

    private RowMapper<Map<String, Object>> coachListRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            String rawBio = rs.getString("Bio");
            m.put("coachId", rs.getInt("CoachID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("avatarUrl", rs.getString("AvatarUrl"));
            m.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            m.put("bio", sanitizeCoachBio(rawBio));
            m.put("acceptingCustomers", extractCoachMatchAvailability(rawBio));
            m.put("averageRating",
                    rs.getObject("AvgRating") != null ? Math.round(rs.getDouble("AvgRating") * 100.0) / 100.0 : 0);
            m.put("reviewCount", rs.getInt("ReviewCount"));
            return m;
        };
    }

    private RowMapper<Map<String, Object>> coachDetailRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            String rawBio = rs.getString("Bio");
            m.put("coachId", rs.getInt("CoachID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("avatarUrl", rs.getString("AvatarUrl"));
            java.sql.Date dob = rs.getDate("DateOfBirth");
            m.put("dateOfBirth", dob != null ? dob.toLocalDate().format(DATE_FORMAT) : null);
            m.put("gender", rs.getString("Gender"));
            m.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            m.put("bio", sanitizeCoachBio(rawBio));
            m.put("acceptingCustomers", extractCoachMatchAvailability(rawBio));
            m.put("averageRating",
                    rs.getObject("AvgRating") != null ? Math.round(rs.getDouble("AvgRating") * 100.0) / 100.0 : 0);
            m.put("reviewCount", rs.getInt("ReviewCount"));
            return m;
        };
    }

    /**
     * Row mapper for CoachWeeklyAvailability (avoids relying on the IsAvailable
     * column for compatibility across database variants).
     */
    private RowMapper<Map<String, Object>> availabilityWithoutIsAvailableRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("dayOfWeek", rs.getInt("DayOfWeek"));
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            m.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            m.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            m.put("isAvailable", true);
            return m;
        };
    }

    /**
     * Loads weekly coach availability. Always uses a query that does not depend
     * on the IsAvailable column so it stays compatible with database variants.
     */
    private List<Map<String, Object>> loadWeeklyAvailability(int coachId) {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT cwa.DayOfWeek, cwa.TimeSlotID, ts.SlotIndex, ts.StartTime, ts.EndTime
                FROM dbo.CoachWeeklyAvailability cwa
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = cwa.TimeSlotID
                WHERE cwa.CoachID = ? AND cwa.IsAvailable = 1
                ORDER BY cwa.DayOfWeek, ts.SlotIndex
                """, availabilityWithoutIsAvailableRowMapper(), coachId);

        // Default behavior: if coach has no configured rows, treat all 8 slots x 7 days as available.
        if (!rows.isEmpty()) {
            return rows;
        }

        List<Map<String, Object>> timeSlots = jdbcTemplate.query("""
                SELECT TimeSlotID, SlotIndex, StartTime, EndTime
                FROM dbo.TimeSlots
                ORDER BY SlotIndex
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            m.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            m.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            return m;
        });

        List<Map<String, Object>> defaults = new ArrayList<>();
        for (int day = 1; day <= 7; day++) {
            for (Map<String, Object> slot : timeSlots) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("dayOfWeek", day);
                m.put("timeSlotId", slot.get("timeSlotId"));
                m.put("slotIndex", slot.get("slotIndex"));
                m.put("startTime", slot.get("startTime"));
                m.put("endTime", slot.get("endTime"));
                m.put("isAvailable", true);
                defaults.add(m);
            }
        }
        return defaults;
    }

    private RowMapper<Map<String, Object>> sessionSlotRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            m.put("dayOfWeek", rs.getInt("DayOfWeek"));
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            m.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            m.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            m.put("status", rs.getString("Status"));
            m.put("cancelReason", rs.getString("CancelReason"));
            return m;
        };
    }

    private RowMapper<Map<String, Object>> feedbackRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rating", rs.getInt("Rating"));
            m.put("comment", rs.getString("Comment"));
            m.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            m.put("customerName", rs.getString("CustomerName"));
            return m;
        };
    }

    private RowMapper<Map<String, Object>> myScheduleRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("ptRequestId", rs.getInt("PTRequestID"));
            m.put("coachId", rs.getInt("CoachID"));
            m.put("coachName", rs.getString("CoachName"));
            m.put("coachPhone", rs.getString("CoachPhone"));
            m.put("sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            m.put("dayOfWeek", rs.getInt("DayOfWeek"));
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            m.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            m.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            m.put("status", rs.getString("Status"));
            m.put("cancelReason", rs.getString("CancelReason"));
            return m;
        };
    }

    private RowMapper<Map<String, Object>> coachSessionRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ptSessionId", rs.getInt("PTSessionID"));
            m.put("ptRequestId", rs.getInt("PTRequestID"));
            m.put("customerId", rs.getInt("CustomerID"));
            m.put("customerName", rs.getString("CustomerName"));
            m.put("customerEmail", rs.getString("CustomerEmail"));
            m.put("customerPhone", rs.getString("CustomerPhone"));
            m.put("avatarUrl", rs.getString("AvatarUrl"));
            m.put("sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()));
            m.put("dayOfWeek", rs.getInt("DayOfWeek"));
            m.put("timeSlotId", rs.getInt("TimeSlotID"));
            m.put("slotIndex", rs.getInt("SlotIndex"));
            m.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            m.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            m.put("status", rs.getString("Status"));
            return m;
        };
    }

    private RowMapper<Map<String, Object>> coachCustomersRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("customerId", rs.getInt("CustomerID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("avatarUrl", rs.getString("AvatarUrl"));
            m.put("sessionCount", rs.getInt("SessionCount"));
            return m;
        };
    }

    private void notifyPtRequestCreated(int requestId, int customerId, int coachId, LocalDate startDate, LocalDate endDate) {
        String customerName = loadUserFullName(customerId);
        notificationService.notifyUser(
                coachId,
                "PT_REQUEST_CREATED",
                "New PT booking request",
                customerName + " sent you a PT booking request for " + dateToString(startDate) + " to "
                        + dateToString(endDate) + ".",
                "/coach/booking-requests",
                requestId,
                "PT_REQUEST_CREATED_" + requestId);
        notificationService.notifyUser(
                customerId,
                "PT_REQUEST_SUBMITTED",
                "PT booking request submitted",
                "Your PT booking request was sent successfully and is waiting for coach approval.",
                "/customer/coach-booking",
                requestId,
                "PT_REQUEST_SUBMITTED_" + requestId);
    }

    private void notifyInstantPtBookingCreated(int requestId, int customerId, int coachId, LocalDate startDate,
            LocalDate endDate) {
        String customerName = loadUserFullName(customerId);
        notificationService.notifyUser(
                coachId,
                "PT_BOOKING_CONFIRMED",
                "New PT phase booked",
                customerName + " booked a recurring PT phase from " + dateToString(startDate) + " to "
                        + dateToString(endDate) + ".",
                "/coach/schedule?tab=schedule",
                requestId,
                "PT_BOOKING_CONFIRMED_" + requestId);
        notificationService.notifyUser(
                customerId,
                "PT_BOOKING_CONFIRMED",
                "PT booking confirmed",
                "Your recurring PT booking is confirmed and your schedule is ready.",
                "/customer/coach-booking",
                requestId,
                "PT_BOOKING_CONFIRMED_CUSTOMER_" + requestId);
    }

    private void notifyPtRequestDecision(int requestId, int customerId, String decision, String message) {
        notificationService.notifyUser(
                customerId,
                "PT_REQUEST_" + decision,
                "APPROVED".equals(decision) ? "PT booking request approved" : "PT booking request denied",
                message,
                "/customer/coach-booking",
                requestId,
                "PT_REQUEST_" + decision + "_" + requestId);
    }

    private void notifyCustomerCancelledSession(SessionNotificationContext session, String reason) {
        notificationService.notifyUser(
                session.coachId(),
                "PT_SESSION_CANCELLED_BY_CUSTOMER",
                "Session cancelled by customer",
                session.customerName() + " cancelled the PT session on " + session.sessionDate() + " at "
                        + session.timeLabel() + ". Reason: " + reason,
                "/coach/schedule?tab=schedule",
                session.sessionId(),
                "PT_SESSION_CANCELLED_BY_CUSTOMER_" + session.sessionId());
        notificationService.notifyUser(
                session.customerId(),
                "PT_SESSION_CANCEL_CONFIRM",
                "PT session cancelled",
                "You cancelled the PT session on " + session.sessionDate() + " at " + session.timeLabel() + ".",
                "/customer/coach-booking",
                session.sessionId(),
                "PT_SESSION_CANCEL_CONFIRM_" + session.sessionId());
    }

    private void notifyCoachCancelledSession(SessionNotificationContext session, String reason) {
        notificationService.notifyUser(
                session.customerId(),
                "PT_SESSION_CANCELLED_BY_COACH",
                "Session cancelled by coach",
                session.coachName() + " cancelled your PT session on " + session.sessionDate() + " at "
                        + session.timeLabel() + ". Reason: " + reason,
                "/customer/coach-booking",
                session.sessionId(),
                "PT_SESSION_CANCELLED_BY_COACH_" + session.sessionId());
        notificationService.notifyUser(
                session.coachId(),
                "PT_SESSION_CANCEL_CONFIRM",
                "PT session cancelled",
                "You cancelled the PT session with " + session.customerName() + " on " + session.sessionDate()
                        + " at " + session.timeLabel() + ".",
                "/coach/schedule?tab=schedule",
                session.sessionId(),
                "PT_SESSION_COACH_CANCEL_CONFIRM_" + session.sessionId());
    }

    private void notifyCoachAboutRescheduleRequest(int sessionId, int customerId, int coachId, String requestedSlot) {
        notificationService.notifyUser(
                coachId,
                "PT_RESCHEDULE_REQUESTED",
                "New reschedule request",
                loadUserFullName(customerId) + " requested to move a PT session to " + requestedSlot + ".",
                "/coach/schedule?tab=schedule",
                sessionId,
                "PT_RESCHEDULE_REQUESTED_" + sessionId);
    }

    private void notifyDirectReschedule(int sessionId, int customerId, int coachId, String oldSlot, String newSlot,
            String reason) {
        String suffix = reason == null || reason.isBlank() ? "" : " Reason: " + reason;
        notificationService.notifyUser(
                coachId,
                "PT_SESSION_RESCHEDULED_BY_CUSTOMER",
                "PT session moved",
                loadUserFullName(customerId) + " moved a PT session from " + oldSlot + " to " + newSlot + "." + suffix,
                "/coach/schedule?tab=schedule",
                sessionId,
                "PT_SESSION_RESCHEDULED_BY_CUSTOMER_" + sessionId);
        notificationService.notifyUser(
                customerId,
                "PT_SESSION_RESCHEDULE_CONFIRMED",
                "PT session updated",
                "Your PT session moved from " + oldSlot + " to " + newSlot + ".",
                "/customer/coach-booking",
                sessionId,
                "PT_SESSION_RESCHEDULE_CONFIRMED_" + sessionId);
    }

    private void notifyCustomerAboutRescheduleDecision(int sessionId, String decision, String message) {
        Integer customerId = jdbcTemplate.queryForObject(
                "SELECT CustomerID FROM dbo.PTSessions WHERE PTSessionID = ?",
                Integer.class, sessionId);
        if (customerId == null) {
            return;
        }
        notificationService.notifyUser(
                customerId,
                "PT_RESCHEDULE_" + decision,
                "APPROVED".equals(decision) ? "Reschedule approved" : "Reschedule denied",
                message,
                "/customer/coach-booking",
                sessionId,
                "PT_RESCHEDULE_" + decision + "_" + sessionId);
    }

    private void notifyReplacementOfferDecision(int sessionId, int originalCoachId, int replacementCoachId,
            String decision) {
        String status = "ACCEPT".equals(decision) ? "accepted" : "declined";
        notificationService.notifyUser(
                originalCoachId,
                "PT_REPLACEMENT_" + decision,
                "Replacement coach " + status,
                "The customer " + status + " your replacement-coach offer for PT session #" + sessionId + ".",
                "/coach/booking-requests",
                sessionId,
                "PT_REPLACEMENT_" + decision + "_ORIGINAL_" + sessionId);
        notificationService.notifyUser(
                replacementCoachId,
                "PT_REPLACEMENT_" + decision,
                "Replacement coach " + status,
                "Your replacement-coach offer for PT session #" + sessionId + " was " + status + ".",
                "/coach/schedule?tab=schedule",
                sessionId,
                "PT_REPLACEMENT_" + decision + "_REPLACEMENT_" + sessionId);
    }

    private SessionNotificationContext loadSessionNotificationContext(int sessionId) {
        return jdbcTemplate.query("""
                SELECT TOP (1)
                    s.PTSessionID,
                    s.CustomerID,
                    s.CoachID,
                    s.SessionDate,
                    uCustomer.FullName AS CustomerName,
                    uCoach.FullName AS CoachName,
                    ts.StartTime,
                    ts.EndTime
                FROM dbo.PTSessions s
                JOIN dbo.Users uCustomer ON uCustomer.UserID = s.CustomerID
                JOIN dbo.Users uCoach ON uCoach.UserID = s.CoachID
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                WHERE s.PTSessionID = ?
                """, (rs, i) -> new SessionNotificationContext(
                rs.getInt("PTSessionID"),
                rs.getInt("CustomerID"),
                rs.getInt("CoachID"),
                rs.getString("CustomerName"),
                rs.getString("CoachName"),
                dateToString(rs.getDate("SessionDate").toLocalDate()),
                (rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString().substring(0, 5) : "--:--")
                        + "-"
                        + (rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString().substring(0, 5) : "--:--")),
                sessionId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));
    }

    private String requestedSlotSummary(LocalDate sessionDate, int timeSlotId) {
        Map<String, Object> slot = jdbcTemplate.query("""
                SELECT TOP (1) StartTime, EndTime
                FROM dbo.TimeSlots
                WHERE TimeSlotID = ?
                """, (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("startTime", rs.getTime("StartTime") != null ? rs.getTime("StartTime").toString() : null);
            item.put("endTime", rs.getTime("EndTime") != null ? rs.getTime("EndTime").toString() : null);
            return item;
        }, timeSlotId).stream().findFirst().orElse(Map.of());
        String start = asText(slot.get("startTime"));
        String end = asText(slot.get("endTime"));
        String compactStart = start != null && start.length() >= 5 ? start.substring(0, 5) : "--:--";
        String compactEnd = end != null && end.length() >= 5 ? end.substring(0, 5) : "--:--";
        return dateToString(sessionDate) + " at " + compactStart + "-" + compactEnd;
    }

    private String loadUserFullName(int userId) {
        String name = jdbcTemplate.queryForObject(
                "SELECT FullName FROM dbo.Users WHERE UserID = ?",
                String.class, userId);
        return name == null || name.isBlank() ? "A customer" : name;
    }

    private RowMapper<Map<String, Object>> customerDetailRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("customerId", rs.getInt("CustomerID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("avatarUrl", rs.getString("AvatarUrl"));
            java.sql.Date dob = rs.getDate("DateOfBirth");
            m.put("dateOfBirth", dob != null ? dob.toLocalDate().format(DATE_FORMAT) : null);
            m.put("gender", rs.getString("Gender"));
            return m;
        };
    }

    private RowMapper<Map<String, Object>> adminCoachListRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            String rawBio = rs.getString("Bio");
            m.put("coachId", rs.getInt("CoachID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            m.put("bio", sanitizeCoachBio(rawBio));
            m.put("acceptingCustomers", extractCoachMatchAvailability(rawBio));
            m.put("averageRating",
                    rs.getObject("AvgRating") != null ? Math.round(rs.getDouble("AvgRating") * 100.0) / 100.0 : 0);
            m.put("reviewCount", rs.getInt("ReviewCount"));
            m.put("studentCount", rs.getInt("StudentCount"));
            return m;
        };
    }

    private boolean extractCoachMatchAvailability(String rawBio) {
        return rawBio == null || !rawBio.contains(COACH_MATCH_OPT_OUT_TOKEN);
    }

    private String sanitizeCoachBio(String rawBio) {
        if (rawBio == null) {
            return null;
        }
        String sanitized = rawBio.replace(COACH_MATCH_OPT_OUT_TOKEN, "").trim();
        return sanitized.isBlank() ? null : sanitized;
    }

    private String mergeCoachAvailabilityFlagIntoBio(String rawBio, boolean acceptingCustomers) {
        String cleanBio = sanitizeCoachBio(rawBio);
        if (acceptingCustomers) {
            return cleanBio;
        }
        return cleanBio == null ? COACH_MATCH_OPT_OUT_TOKEN : cleanBio + "\n" + COACH_MATCH_OPT_OUT_TOKEN;
    }

    private ResponseStatusException unsupportedAction(String action) {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Unsupported coach-booking action: " + action);
    }

    private record MembershipForPt(Integer customerMembershipId, boolean allowsCoachBooking, LocalDate coverageEndDate) {
    }

    private record ExistingPtBooking(String status, LocalDate startDate, LocalDate endDate, int coachId) {
    }

    private record RequestedSlot(int dayOfWeek, int timeSlotId) {
    }

    private record MatchSummary(
            int exactMatchedSlots,
            int matchedSlots,
            int bookedConflictSlots,
            List<Map<String, Object>> unavailableSlots,
            List<Map<String, Object>> alternativeSlots,
            List<Map<String, Object>> resolvedSlots) {
    }

    private record RescheduleMeta(String state, LocalDate requestedDate, int requestedTimeSlotId, String note) {
    }

    private record SessionNotificationContext(int sessionId, int customerId, int coachId, String customerName,
            String coachName, String sessionDate, String timeLabel) {
    }
}
