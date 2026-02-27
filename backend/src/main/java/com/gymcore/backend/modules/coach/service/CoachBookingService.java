package com.gymcore.backend.modules.coach.service;

import com.gymcore.backend.modules.auth.service.AuthService;
import java.sql.Timestamp;
import java.time.LocalDate;
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
    private static final String RESCHEDULE_REQUEST_PREFIX = "RESCHEDULE_REQUEST|";
    private static final String RESCHEDULE_DENIED_PREFIX = "RESCHEDULE_DENIED|";

    private final JdbcTemplate jdbcTemplate;
    private final AuthService authService;

    public CoachBookingService(JdbcTemplate jdbcTemplate, AuthService authService) {
        this.jdbcTemplate = jdbcTemplate;
        this.authService = authService;
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
            case "customer-get-my-schedule" -> customerGetMySchedule(request);
            case "customer-delete-session" -> customerDeleteSession(request);
            case "coach-get-pt-requests" -> coachGetPtRequests(request);
            case "coach-approve-pt-request" -> coachApprovePtRequest(request);
            case "coach-deny-pt-request" -> coachDenyPtRequest(request);
            case "customer-cancel-session" -> customerCancelSession(request);
            case "customer-reschedule-session" -> customerRescheduleSession(request);
            case "customer-submit-feedback" -> customerSubmitFeedback(request);
            case "coach-update-availability" -> coachUpdateAvailability(request);
            case "coach-get-availability" -> coachGetMyAvailability(request);
            case "coach-get-schedule" -> coachGetSchedule(request);
            case "coach-get-pt-sessions" -> coachGetPtSessions(request);
            case "coach-create-session-notes" -> coachCreateSessionNotes(request);
            case "coach-update-session-note" -> coachUpdateSessionNote(request);
            case "coach-get-customers" -> coachGetCustomers(request);
            case "coach-get-customer-detail" -> coachGetCustomerDetail(request);
            case "coach-get-customer-history" -> coachGetCustomerHistory(request);
            case "coach-update-customer-progress" -> coachUpdateCustomerProgress(request);
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
            default -> todo(action, payload);
        };
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
                """, coachListRowMapper());
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
                SELECT TOP (5) cf.Rating, cf.Comment, cf.CreatedAt, u.FullName AS CustomerName
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
                        SELECT s.SessionDate, s.DayOfWeek, s.TimeSlotID, ts.SlotIndex, ts.StartTime, ts.EndTime, s.Status
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
        requireCustomer(payload);
        String startDateStr = requireText(payload, "startDate");
        String endDateStr = requireText(payload, "endDate");
        LocalDate startDate = LocalDate.parse(startDateStr);
        LocalDate endDate = LocalDate.parse(endDateStr);

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
            boolean fullMatch = summary.matchedSlots() == requestedSlots.size();
            boolean partialMatch = !fullMatch
                    && (summary.matchedSlots() > 0 || summary.bookedConflictSlots() > 0);

            Map<String, Object> item = new LinkedHashMap<>(coach);
            item.put("matchType", fullMatch ? "FULL" : "PARTIAL");
            item.put("matchedSlots", summary.matchedSlots());
            item.put("bookedConflictSlots", summary.bookedConflictSlots());
            item.put("requestedSlots", requestedSlots.size());
            item.put("unavailableSlots", summary.unavailableSlots());

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
        int coachId = requireInteger(payload, "coachId");
        String startDateStr = requireText(payload, "startDate");
        String endDateStr = requireText(payload, "endDate");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> slots = (List<Map<String, Object>>) payload.get("slots");
        if (slots == null || slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "At least one slot (dayOfWeek, timeSlotId) is required.");
        }

        LocalDate startDate = LocalDate.parse(startDateStr);
        LocalDate endDate = LocalDate.parse(endDateStr);
        if (!endDate.isAfter(startDate) && !endDate.isEqual(startDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate must be >= startDate.");
        }

        // Tự động lấy gói ACTIVE của customer nêú có.
        // Thay vì báo lỗi nếu không có, ta sẽ lấy NULL để cho phép đặt không cần
        // membership.
        MembershipForPt membership = findActiveMembershipForPt(customer.userId(), startDate, endDate);
        Integer customerMembershipId = membership.customerMembershipId();
        if (customerMembershipId == null || !membership.allowsCoachBooking()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You need an ACTIVE Gym + Coach membership covering the selected period.");
        }
        requireCoachExists(coachId);

        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        try {
            jdbcTemplate.update(con -> {
                var ps = con.prepareStatement(
                        """
                                INSERT INTO dbo.PTRecurringRequests (CustomerID, CoachID, CustomerMembershipID, StartDate, EndDate, Status)
                                VALUES (?, ?, ?, ?, ?, 'PENDING')
                                """,
                        java.sql.Statement.RETURN_GENERATED_KEYS);
                ps.setInt(1, customer.userId());
                ps.setInt(2, coachId);
                ps.setInt(3, customerMembershipId);
                ps.setObject(4, startDate);
                ps.setObject(5, endDate);
                return ps;
            }, keyHolder);
        } catch (DataAccessException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid membership or dates. Membership must be ACTIVE and allow coach booking.");
        }
        Number key = keyHolder.getKey();
        int ptRequestId = (key != null) ? key.intValue() : 0;
        if (ptRequestId == 0) {
            List<Integer> ids = jdbcTemplate.query("SELECT CAST(SCOPE_IDENTITY() AS INT) AS id",
                    (rs, i) -> rs.getObject("id") != null ? Integer.valueOf(rs.getInt("id")) : Integer.valueOf(0));
            Integer first = ids.isEmpty() ? null : ids.get(0);
            if (first != null && first.intValue() != 0)
                ptRequestId = first.intValue();
        }
        if (ptRequestId == 0) {
            List<Integer> ids = jdbcTemplate.query(
                    "SELECT PTRequestID FROM dbo.PTRecurringRequests WHERE CustomerID = ? ORDER BY PTRequestID DESC",
                    (rs, i) -> rs.getInt("PTRequestID"), customer.userId());
            ptRequestId = ids.isEmpty() ? 0 : ids.get(0);
        }

        for (Map<String, Object> slot : slots) {
            int dayOfWeek = requireInteger(slot, "dayOfWeek");
            int timeSlotId = requireInteger(slot, "timeSlotId");
            if (dayOfWeek < 1 || dayOfWeek > 7)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dayOfWeek must be 1-7.");
            jdbcTemplate.update("INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID) VALUES (?, ?, ?)",
                    ptRequestId, dayOfWeek, timeSlotId);
        }

        // In PENDING flow, we do NOT generate sessions until coach approves
        return Map.of(
                "ptRequestId", ptRequestId,
                "status", "PENDING",
                "message", "Yêu cầu đặt lịch đã được gửi. Vui lòng chờ PT xác nhận.");
    }

    private int generatePTSessions(int ptRequestId, int customerId, int coachId, LocalDate startDate, LocalDate endDate,
            List<Map<String, Object>> slots) {
        int count = 0;
        for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
            int dayOfWeek = d.getDayOfWeek().getValue();
            for (Map<String, Object> slot : slots) {
                if (parseInteger(slot.get("dayOfWeek")) == dayOfWeek) {
                    int timeSlotId = parseInteger(slot.get("timeSlotId"));
                    try {
                        jdbcTemplate.update(
                                """
                                        INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
                                        VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')
                                        """,
                                ptRequestId, customerId, coachId, d, dayOfWeek, timeSlotId);
                        count++;
                    } catch (DataAccessException ignored) {
                    }
                }
            }
        }
        return count;
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
                        WHERE s.CustomerID = ? AND s.Status != 'CANCELLED'
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

        // Group notes by session ID
        Map<Integer, List<Map<String, Object>>> notesBySession = new LinkedHashMap<>();
        for (Map<String, Object> note : allNotes) {
            int sid = (Integer) note.get("ptSessionId");
            notesBySession.computeIfAbsent(sid, k -> new java.util.ArrayList<>()).add(note);
        }

        // Attach notes to each session
        for (Map<String, Object> session : items) {
            int sid = (Integer) session.get("ptSessionId");
            session.put("notes", notesBySession.getOrDefault(sid, List.of()));
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
        return result;
    }

    private Map<String, Object> customerCancelSession(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        int sessionId = requireInteger(payload, "sessionId");
        String reason = asText(((Map<?, ?>) payload.getOrDefault("body", Map.of())).get("cancelReason"));

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
                "SELECT CoachID, SessionDate, TimeSlotID, Status, CancelReason FROM dbo.PTSessions WHERE PTSessionID = ? AND CustomerID = ?",
                (rs, i) -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("coachId", rs.getInt("CoachID"));
                    item.put("sessionDate", rs.getDate("SessionDate").toLocalDate());
                    item.put("timeSlotId", rs.getInt("TimeSlotID"));
                    item.put("status", rs.getString("Status"));
                    item.put("cancelReason", rs.getString("CancelReason"));
                    return item;
                },
                sessionId, customer.userId()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        int coachId = (Integer) session.get("coachId");
        String status = String.valueOf(session.get("status"));
        if (!"SCHEDULED".equalsIgnoreCase(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only SCHEDULED sessions can be rescheduled.");
        }

        RescheduleMeta currentMeta = parseRescheduleMeta(asText(session.get("cancelReason")));
        if (currentMeta != null && "PENDING".equals(currentMeta.state())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reschedule request is already pending.");
        }

        if (LocalDate.now().isAfter((LocalDate) session.get("sessionDate"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reschedule a past session.");
        }
        if (newDate.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot request reschedule to a past date.");
        }
        if (!isCoachWeeklyAvailable(coachId, newDate.getDayOfWeek().getValue(), newTimeSlotId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach is not available for requested slot.");
        }

        List<Integer> conflicts = jdbcTemplate.query(
                """
                        SELECT PTSessionID FROM dbo.PTSessions
                        WHERE CoachID = ? AND SessionDate = ? AND TimeSlotID = ? AND Status IN ('SCHEDULED','COMPLETED') AND PTSessionID <> ?
                        """,
                (rs, i) -> rs.getInt("PTSessionID"), coachId, newDate, newTimeSlotId, sessionId);
        if (!conflicts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach is not available at the chosen slot.");
        }

        jdbcTemplate.update("""
                UPDATE dbo.PTSessions SET CancelReason = ?, UpdatedAt = SYSDATETIME()
                WHERE PTSessionID = ? AND CustomerID = ?
                """, encodeRescheduleRequest(newDate, newTimeSlotId, reason), sessionId, customer.userId());
        return Map.of(
                "sessionId", sessionId,
                "status", "PENDING_COACH_APPROVAL",
                "requestedSessionDate", newDateStr,
                "requestedTimeSlotId", newTimeSlotId,
                "message", "Reschedule request sent to coach.");
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
                WHERE r.CoachID = ? AND r.Status = 'PENDING'
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

            // Fetch slots for this request
            List<Map<String, Object>> slots = jdbcTemplate.query("""
                    SELECT DayOfWeek, TimeSlotID FROM dbo.PTRequestSlots WHERE PTRequestID = ?
                    """,
                    (rs2, i2) -> Map.of("dayOfWeek", rs2.getInt("DayOfWeek"), "timeSlotId", rs2.getInt("TimeSlotID")),
                    id);
            m.put("slots", slots);
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
                SELECT CustomerID, StartDate, EndDate, Status FROM dbo.PTRecurringRequests
                WHERE PTRequestID = ? AND CoachID = ?
                """, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("customerId", rs.getInt("CustomerID"));
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

        if (hasPtRequestDenyReasonColumn()) {
            jdbcTemplate.update(
                    "UPDATE dbo.PTRecurringRequests SET Status = 'APPROVED', DenyReason = NULL, UpdatedAt = SYSDATETIME() WHERE PTRequestID = ?",
                    requestId);
        } else {
            jdbcTemplate.update(
                    "UPDATE dbo.PTRecurringRequests SET Status = 'APPROVED', UpdatedAt = SYSDATETIME() WHERE PTRequestID = ?",
                    requestId);
        }

        int count = generatePTSessions(requestId, (Integer) req.get("customerId"), coach.userId(),
                (LocalDate) req.get("startDate"), (LocalDate) req.get("endDate"), slots);

        return Map.of("ptRequestId", requestId, "status", "APPROVED", "sessionsCreated", count);
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
        return Map.of(
                "message", "Availability updated successfully.",
                "inserted", insertedCount,
                "total", insertedCount);
    }

    private Map<String, Object> coachGetMyAvailability(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        List<Map<String, Object>> weeklyAvailability = loadWeeklyAvailability(coach.userId());
        return Map.of("weeklyAvailability", weeklyAvailability);
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
                               ts.SlotIndex, ts.StartTime, ts.EndTime, u.FullName AS CustomerName, u.Email AS CustomerEmail, u.Phone AS CustomerPhone
                        FROM dbo.PTSessions s
                        JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                        JOIN dbo.Users u ON u.UserID = s.CustomerID
                        WHERE s.CoachID = ? AND s.SessionDate >= ? AND s.SessionDate <= ?
                        ORDER BY s.SessionDate, ts.SlotIndex
                        """,
                coachSessionRowMapper(), coachId, from, to);
        return Map.of("items", items, "fromDate", dateToString(from), "toDate", dateToString(to));
    }

    private Map<String, Object> coachCreateSessionNotes(Map<String, Object> payload) {
        AuthService.AuthContext coach = requireCoach(payload);
        int sessionId = requireInteger(payload, "sessionId");
        String noteContent = requireText(((Map<?, ?>) payload.getOrDefault("body", Map.of())), "noteContent");

        requireSessionBelongsToCoach(sessionId, coach.userId());
        jdbcTemplate.update("INSERT INTO dbo.PTSessionNotes (PTSessionID, NoteContent) VALUES (?, ?)", sessionId,
                noteContent);
        return Map.of("ptSessionId", sessionId, "message", "Note added.");
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
                        SELECT DISTINCT u.UserID AS CustomerID, u.FullName, u.Email, u.Phone,
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
                "INSERT INTO dbo.CustomerHealthHistory (CustomerID, HeightCm, WeightKg, BMI) VALUES (?, ?, ?, ?)",
                customerId, heightCm, weightKg,
                heightCm.doubleValue() > 0 ? weightKg.doubleValue() / Math.pow(heightCm.doubleValue() / 100, 2) : 0);

        jdbcTemplate.update(
                """
                        IF EXISTS (SELECT 1 FROM dbo.CustomerHealthCurrent WHERE CustomerID = ?)
                            UPDATE dbo.CustomerHealthCurrent SET HeightCm = ?, WeightKg = ?, BMI = ?, UpdatedAt = SYSDATETIME() WHERE CustomerID = ?
                        ELSE
                            INSERT INTO dbo.CustomerHealthCurrent (CustomerID, HeightCm, WeightKg, BMI) VALUES (?, ?, ?, ?)
                        """,
                customerId, heightCm, weightKg,
                heightCm.doubleValue() > 0 ? weightKg.doubleValue() / Math.pow(heightCm.doubleValue() / 100, 2) : 0,
                customerId, customerId, heightCm, weightKg,
                heightCm.doubleValue() > 0 ? weightKg.doubleValue() / Math.pow(heightCm.doubleValue() / 100, 2) : 0);

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

        if (fullName != null)
            jdbcTemplate.update("UPDATE dbo.Users SET FullName = ?, UpdatedAt = SYSDATETIME() WHERE UserID = ?",
                    fullName, coachId);
        if (phone != null)
            jdbcTemplate.update("UPDATE dbo.Users SET Phone = ?, UpdatedAt = SYSDATETIME() WHERE UserID = ?", phone,
                    coachId);
        jdbcTemplate.update("""
                UPDATE dbo.Coaches SET ExperienceYears = COALESCE(?, ExperienceYears), Bio = COALESCE(?, Bio),
                       DateOfBirth = CASE WHEN ? IS NOT NULL THEN CAST(? AS DATE) ELSE DateOfBirth END,
                       Gender = COALESCE(?, Gender)
                WHERE CoachID = ?
                """, experienceYears, bio, dateOfBirth, dateOfBirth, gender, coachId);
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
        for (Map<String, Object> slot : slots) {
            int dayOfWeek = requireInteger(slot, "dayOfWeek");
            int timeSlotId = requireInteger(slot, "timeSlotId");
            if (dayOfWeek < 1 || dayOfWeek > 7) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dayOfWeek must be 1-7.");
            }
            String key = dayOfWeek + "-" + timeSlotId;
            if (seen.add(key)) {
                normalized.add(new RequestedSlot(dayOfWeek, timeSlotId));
            }
        }
        return normalized;
    }

    private MatchSummary evaluateCoachMatch(int coachId, LocalDate startDate, LocalDate endDate,
            List<RequestedSlot> requestedSlots) {
        List<Map<String, Object>> weeklyAvailability = loadWeeklyAvailability(coachId);
        Set<String> availablePairs = new HashSet<>();
        for (Map<String, Object> item : weeklyAvailability) {
            availablePairs.add(requireInteger(item, "dayOfWeek") + "-" + requireInteger(item, "timeSlotId"));
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

        int matched = 0;
        int bookedConflicts = 0;
        List<Map<String, Object>> unavailable = new ArrayList<>();
        for (RequestedSlot slot : requestedSlots) {
            String key = slot.dayOfWeek() + "-" + slot.timeSlotId();
            if (!availablePairs.contains(key)) {
                unavailable.add(Map.of(
                        "dayOfWeek", slot.dayOfWeek(),
                        "timeSlotId", slot.timeSlotId(),
                        "reason", "NO_WEEKLY_AVAILABILITY"));
                continue;
            }
            if (bookedPairs.contains(key)) {
                bookedConflicts++;
                unavailable.add(Map.of(
                        "dayOfWeek", slot.dayOfWeek(),
                        "timeSlotId", slot.timeSlotId(),
                        "reason", "BOOKED_IN_RANGE"));
                continue;
            }
            matched++;
        }

        return new MatchSummary(matched, bookedConflicts, unavailable);
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

    private MembershipForPt findActiveMembershipForPt(int customerId, LocalDate startDate, LocalDate endDate) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT TOP 1 cm.CustomerMembershipID, mp.AllowsCoachBooking
                    FROM dbo.CustomerMemberships cm
                    JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                    WHERE cm.CustomerID = ? AND cm.Status = 'ACTIVE'
                      AND ? >= cm.StartDate AND ? <= cm.EndDate AND mp.AllowsCoachBooking = 1
                    ORDER BY cm.EndDate ASC
                    """,
                    (rs, i) -> new MembershipForPt(rs.getInt("CustomerMembershipID"),
                            rs.getBoolean("AllowsCoachBooking")),
                    customerId, startDate, endDate);
        } catch (EmptyResultDataAccessException e) {
            // Cho phép trả về NULL ID nếu không có membership để người dùng có thể đặt
            // không cần gói
            return new MembershipForPt(null, false);
        }
    }

    private MembershipForPt requireValidMembershipForPt(int customerId, int customerMembershipId,
            LocalDate startDate, LocalDate endDate) {
        List<MembershipForPt> list = jdbcTemplate.query("""
                SELECT cm.CustomerMembershipID, mp.AllowsCoachBooking
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.CustomerMembershipID = ? AND cm.Status = 'ACTIVE'
                  AND ? >= cm.StartDate AND ? <= cm.EndDate AND mp.AllowsCoachBooking = 1
                """,
                (rs, i) -> new MembershipForPt(rs.getInt("CustomerMembershipID"), rs.getBoolean("AllowsCoachBooking")),
                customerId, customerMembershipId, startDate, endDate);
        if (list.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Membership ID không hợp lệ hoặc gói không ACTIVE/không cho phép đặt PT. Để không nhập ID, hãy bỏ trống — hệ thống sẽ dùng gói ACTIVE của bạn.");
        }
        return list.get(0);
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
            m.put("coachId", rs.getInt("CoachID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("avatarUrl", rs.getString("AvatarUrl"));
            m.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            m.put("bio", rs.getString("Bio"));
            m.put("averageRating",
                    rs.getObject("AvgRating") != null ? Math.round(rs.getDouble("AvgRating") * 100.0) / 100.0 : 0);
            m.put("reviewCount", rs.getInt("ReviewCount"));
            return m;
        };
    }

    private RowMapper<Map<String, Object>> coachDetailRowMapper() {
        return (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("coachId", rs.getInt("CoachID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("avatarUrl", rs.getString("AvatarUrl"));
            java.sql.Date dob = rs.getDate("DateOfBirth");
            m.put("dateOfBirth", dob != null ? dob.toLocalDate().format(DATE_FORMAT) : null);
            m.put("gender", rs.getString("Gender"));
            m.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            m.put("bio", rs.getString("Bio"));
            m.put("averageRating",
                    rs.getObject("AvgRating") != null ? Math.round(rs.getDouble("AvgRating") * 100.0) / 100.0 : 0);
            m.put("reviewCount", rs.getInt("ReviewCount"));
            return m;
        };
    }

    /**
     * Row mapper cho CoachWeeklyAvailability (không dùng cột IsAvailable để tương
     * thích mọi DB).
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
     * Lấy lịch trống theo tuần của PT. Luôn dùng query không dùng cột IsAvailable
     * để tương thích DB thiếu cột.
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
            m.put("sessionCount", rs.getInt("SessionCount"));
            return m;
        };
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
            m.put("coachId", rs.getInt("CoachID"));
            m.put("fullName", rs.getString("FullName"));
            m.put("email", rs.getString("Email"));
            m.put("phone", rs.getString("Phone"));
            m.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            m.put("bio", rs.getString("Bio"));
            m.put("averageRating",
                    rs.getObject("AvgRating") != null ? Math.round(rs.getDouble("AvgRating") * 100.0) / 100.0 : 0);
            m.put("reviewCount", rs.getInt("ReviewCount"));
            m.put("studentCount", rs.getInt("StudentCount"));
            return m;
        };
    }

    private Map<String, Object> todo(String action, Object payload) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("module", "coach-booking");
        r.put("action", action);
        r.put("status", "TODO");
        r.put("payload", payload == null ? Map.of() : payload);
        return r;
    }

    private record MembershipForPt(Integer customerMembershipId, boolean allowsCoachBooking) {
    }

    private record RequestedSlot(int dayOfWeek, int timeSlotId) {
    }

    private record MatchSummary(int matchedSlots, int bookedConflictSlots, List<Map<String, Object>> unavailableSlots) {
    }

    private record RescheduleMeta(String state, LocalDate requestedDate, int requestedTimeSlotId, String note) {
    }
}
