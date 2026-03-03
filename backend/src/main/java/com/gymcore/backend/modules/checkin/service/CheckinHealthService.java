package com.gymcore.backend.modules.checkin.service;

import com.gymcore.backend.modules.auth.service.AuthService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CheckinHealthService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final JdbcTemplate jdbcTemplate;
    private final AuthService authService;

    public CheckinHealthService(JdbcTemplate jdbcTemplate, AuthService authService) {
        this.jdbcTemplate = jdbcTemplate;
        this.authService = authService;
    }

    public Map<String, Object> execute(String action, Object payload) {
        return switch (action) {
            case "customer-get-qr" -> customerGetQr(asMap(payload));
            case "customer-get-checkin-history" -> customerGetCheckinHistory(asMap(payload));
            case "customer-get-health-current" -> customerGetHealthCurrent(asMap(payload));
            case "customer-get-health-history" -> customerGetHealthHistory(asMap(payload));
            case "customer-get-coach-notes" -> customerGetCoachNotes(asMap(payload));
            case "customer-create-health-record" -> customerCreateHealthRecord(asMap(payload));
            case "reception-scan-checkin" -> receptionScanCheckin(asMap(payload));
            case "reception-validate-membership" -> receptionValidateMembership(asMap(payload));
            case "reception-get-checkin-history" -> receptionGetCheckinHistory(asMap(payload));
            default -> throw unsupportedAction(action);
        };
    }

    private Map<String, Object> customerGetQr(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        Map<String, Object> data = jdbcTemplate.queryForObject("""
                SELECT QrCodeToken, QrIssuedAt FROM dbo.Users WHERE UserID = ?
                """, (rs, rowNum) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("qrCodeToken", rs.getString("QrCodeToken"));
            m.put("qrIssuedAt", timestampToIso(rs.getTimestamp("QrIssuedAt")));
            return m;
        }, customer.userId());
        return data;
    }

    private Map<String, Object> customerGetCheckinHistory(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (50)
                    ci.CheckInID,
                    ci.CheckInTime,
                    mp.PlanName,
                    mp.PlanType,
                    r.FullName AS CheckedByName
                FROM dbo.CheckIns ci
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = ci.CustomerMembershipID
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                LEFT JOIN dbo.Users r ON r.UserID = ci.CheckedByUserID
                WHERE ci.CustomerID = ?
                ORDER BY ci.CheckInTime DESC, ci.CheckInID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("checkInId", rs.getInt("CheckInID"));
            map.put("checkInTime", timestampToIso(rs.getTimestamp("CheckInTime")));
            map.put("planName", rs.getString("PlanName"));
            map.put("planType", rs.getString("PlanType"));
            map.put("checkedByName", rs.getString("CheckedByName"));
            return map;
        }, customer.userId());
        return Map.of("items", items);
    }

    private Map<String, Object> customerGetHealthCurrent(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT HeightCm, WeightKg, BMI, UpdatedAt
                    FROM dbo.CustomerHealthCurrent
                    WHERE CustomerID = ?
                    """, (rs, rowNum) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("heightCm", rs.getBigDecimal("HeightCm"));
                m.put("weightKg", rs.getBigDecimal("WeightKg"));
                m.put("bmi", rs.getBigDecimal("BMI"));
                m.put("updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt")));
                return m;
            }, customer.userId());
        } catch (EmptyResultDataAccessException e) {
            return Map.of();
        }
    }

    private Map<String, Object> customerGetHealthHistory(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (100)
                    HeightCm, WeightKg, BMI, RecordedAt
                FROM dbo.CustomerHealthHistory
                WHERE CustomerID = ?
                ORDER BY RecordedAt DESC
                """, (rs, rowNum) -> Map.of(
                "heightCm", rs.getBigDecimal("HeightCm"),
                "weightKg", rs.getBigDecimal("WeightKg"),
                "bmi", rs.getBigDecimal("BMI"),
                "recordedAt", timestampToIso(rs.getTimestamp("RecordedAt"))), customer.userId());
        return Map.of("items", items);
    }

    private Map<String, Object> customerGetCoachNotes(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (50)
                    n.PTSessionNoteID,
                    n.NoteContent,
                    n.CreatedAt,
                    s.SessionDate,
                    u.FullName AS CoachName
                FROM dbo.PTSessionNotes n
                JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
                JOIN dbo.Users u ON u.UserID = s.CoachID
                WHERE s.CustomerID = ?
                ORDER BY n.CreatedAt DESC
                """, (rs, rowNum) -> Map.of(
                "noteId", rs.getInt("PTSessionNoteID"),
                "noteContent", rs.getString("NoteContent"),
                "createdAt", timestampToIso(rs.getTimestamp("CreatedAt")),
                "sessionDate", dateToString(rs.getDate("SessionDate").toLocalDate()),
                "coachName", rs.getString("CoachName")), customer.userId());
        return Map.of("items", items);
    }

    private Map<String, Object> customerCreateHealthRecord(Map<String, Object> payload) {
        AuthService.AuthContext customer = requireCustomer(payload);
        Double height = parseDouble(payload.get("heightCm"));
        Double weight = parseDouble(payload.get("weightKg"));

        if (height == null || height <= 0 || weight == null || weight <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid height or weight.");
        }

        jdbcTemplate.update("""
                INSERT INTO dbo.CustomerHealthHistory (CustomerID, HeightCm, WeightKg)
                VALUES (?, ?, ?)
                """, customer.userId(), height, weight);

        return customerGetHealthCurrent(payload);
    }

    private AuthService.AuthContext requireCustomer(Map<String, Object> payload) {
        String authorizationHeader = asText(payload.get("authorizationHeader"));
        AuthService.AuthContext context = authService.requireAuthContext(authorizationHeader);
        if (!"CUSTOMER".equalsIgnoreCase(context.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only customer can perform this action.");
        }
        return context;
    }

    private Map<String, Object> receptionScanCheckin(Map<String, Object> payload) {
        AuthService.AuthContext receptionist = requireReceptionist(payload);

        Integer customerId = parseInteger(payload.get("customerId"));
        String qrCodeToken = asText(payload.get("qrCodeToken"));

        CustomerLookup customer;
        if (customerId != null) {
            customer = requireCustomerById(customerId);
        } else if (qrCodeToken != null) {
            customer = requireCustomerByQrToken(qrCodeToken);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide customerId or qrCodeToken.");
        }

        MembershipValidity validity = buildMembershipValidity(customer.customerId());
        if (!validity.valid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, validity.reason());
        }

        try {
            jdbcTemplate.update("""
                    INSERT INTO dbo.CheckIns (CustomerID, CustomerMembershipID, CheckedByUserID)
                    VALUES (?, ?, ?)
                    """, customer.customerId(), validity.customerMembershipId(), receptionist.userId());
        } catch (DataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Check-in failed. Membership is not valid for check-in.");
        }

        Map<String, Object> latest = jdbcTemplate.queryForObject("""
                SELECT TOP (1)
                    ci.CheckInID,
                    ci.CheckInTime
                FROM dbo.CheckIns ci
                WHERE ci.CustomerID = ? AND ci.CustomerMembershipID = ? AND ci.CheckedByUserID = ?
                ORDER BY ci.CheckInID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("checkInId", rs.getInt("CheckInID"));
            m.put("checkInTime", timestampToIso(rs.getTimestamp("CheckInTime")));
            return m;
        }, customer.customerId(),
                validity.customerMembershipId(), receptionist.userId());

        Map<String, Object> customerMap = new LinkedHashMap<>();
        customerMap.put("customerId", customer.customerId());
        customerMap.put("fullName", customer.fullName());
        customerMap.put("email", customer.email());
        customerMap.put("phone", customer.phone());

        Map<String, Object> membershipMap = new LinkedHashMap<>();
        membershipMap.put("customerMembershipId", validity.customerMembershipId());
        membershipMap.put("planName", validity.planName());
        membershipMap.put("planType", validity.planType());
        membershipMap.put("status", "ACTIVE");
        membershipMap.put("startDate", validity.startDate());
        membershipMap.put("endDate", validity.endDate());

        Map<String, Object> data = new LinkedHashMap<>();
        data.putAll(latest);
        data.put("customer", customerMap);
        data.put("membership", membershipMap);
        data.put("checkedBy", Map.of(
                "userId", receptionist.userId(),
                "fullName", receptionist.fullName()));

        return data;
    }

    private Map<String, Object> receptionValidateMembership(Map<String, Object> payload) {
        requireReceptionist(payload);
        Integer customerId = parseInteger(payload.get("customerId"));
        if (customerId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customerId is required.");
        }

        CustomerLookup customer = requireCustomerById(customerId);
        MembershipValidity validity = buildMembershipValidity(customer.customerId());

        Map<String, Object> customerMap = new LinkedHashMap<>();
        customerMap.put("customerId", customer.customerId());
        customerMap.put("fullName", customer.fullName());
        customerMap.put("email", customer.email());
        customerMap.put("phone", customer.phone());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("valid", validity.valid());
        data.put("reason", validity.reason());
        data.put("customer", customerMap);

        if (validity.customerMembershipId() != null) {
            data.put("membership", Map.of(
                    "customerMembershipId", validity.customerMembershipId(),
                    "planName", validity.planName() == null ? "" : validity.planName(),
                    "planType", validity.planType() == null ? "" : validity.planType(),
                    "status", validity.status(),
                    "startDate", validity.startDate() == null ? "" : validity.startDate(),
                    "endDate", validity.endDate() == null ? "" : validity.endDate()));
        } else {
            data.put("membership", Map.of());
        }
        return data;
    }

    private Map<String, Object> receptionGetCheckinHistory(Map<String, Object> payload) {
        requireReceptionist(payload);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (50)
                    ci.CheckInID,
                    ci.CheckInTime,
                    u.UserID AS CustomerID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    mp.PlanName,
                    mp.PlanType,
                    r.UserID AS CheckedByUserID,
                    r.FullName AS CheckedByName
                FROM dbo.CheckIns ci
                JOIN dbo.Users u ON u.UserID = ci.CustomerID
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = ci.CustomerMembershipID
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                LEFT JOIN dbo.Users r ON r.UserID = ci.CheckedByUserID
                ORDER BY ci.CheckInTime DESC, ci.CheckInID DESC
                """, checkinHistoryRowMapper());
        return Map.of("items", items);
    }

    private AuthService.AuthContext requireReceptionist(Map<String, Object> payload) {
        String authorizationHeader = asText(payload.get("authorizationHeader"));
        AuthService.AuthContext context = authService.requireAuthContext(authorizationHeader);
        if (!"RECEPTIONIST".equalsIgnoreCase(context.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only receptionist can perform this action.");
        }
        return context;
    }

    private MembershipValidity buildMembershipValidity(int customerId) {
        List<MembershipSnapshot> activeRows = jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.Status = 'ACTIVE'
                ORDER BY cm.EndDate DESC, cm.CustomerMembershipID DESC
                """, membershipSnapshotRowMapper(), customerId);

        if (!activeRows.isEmpty()) {
            MembershipSnapshot active = activeRows.get(0);
            return new MembershipValidity(
                    true,
                    null,
                    active.customerMembershipId(),
                    active.status(),
                    active.planName(),
                    active.planType(),
                    dateToString(active.startDate()),
                    dateToString(active.endDate()));
        }

        List<MembershipSnapshot> scheduledRows = jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.Status = 'SCHEDULED'
                ORDER BY cm.StartDate ASC, cm.CustomerMembershipID ASC
                """, membershipSnapshotRowMapper(), customerId);
        if (!scheduledRows.isEmpty()) {
            MembershipSnapshot scheduled = scheduledRows.get(0);
            String reason = "Membership not active yet. It is scheduled to start on "
                    + dateToString(scheduled.startDate()) + ".";
            return new MembershipValidity(
                    false,
                    reason,
                    scheduled.customerMembershipId(),
                    scheduled.status(),
                    scheduled.planName(),
                    scheduled.planType(),
                    dateToString(scheduled.startDate()),
                    dateToString(scheduled.endDate()));
        }

        List<MembershipSnapshot> expiredRows = jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.Status = 'EXPIRED'
                ORDER BY cm.EndDate DESC, cm.CustomerMembershipID DESC
                """, membershipSnapshotRowMapper(), customerId);
        if (!expiredRows.isEmpty()) {
            MembershipSnapshot expired = expiredRows.get(0);
            String reason = "Membership expired on " + dateToString(expired.endDate()) + ".";
            return new MembershipValidity(
                    false,
                    reason,
                    expired.customerMembershipId(),
                    expired.status(),
                    expired.planName(),
                    expired.planType(),
                    dateToString(expired.startDate()),
                    dateToString(expired.endDate()));
        }

        List<MembershipSnapshot> pendingRows = jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.Status = 'PENDING'
                ORDER BY cm.CustomerMembershipID DESC
                """, membershipSnapshotRowMapper(), customerId);
        if (!pendingRows.isEmpty()) {
            MembershipSnapshot pending = pendingRows.get(0);
            return new MembershipValidity(
                    false,
                    "Membership payment is pending and not active yet.",
                    pending.customerMembershipId(),
                    pending.status(),
                    pending.planName(),
                    pending.planType(),
                    dateToString(pending.startDate()),
                    dateToString(pending.endDate()));
        }

        return new MembershipValidity(false, "Customer does not have a valid membership.", null, null, null, null, null,
                null);
    }

    private CustomerLookup requireCustomerById(int customerId) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT
                        u.UserID,
                        u.FullName,
                        u.Email,
                        u.Phone
                    FROM dbo.Users u
                    JOIN dbo.Customers c ON c.CustomerID = u.UserID
                    WHERE u.UserID = ?
                    """, customerLookupRowMapper(), customerId);
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found.");
        }
    }

    private CustomerLookup requireCustomerByQrToken(String qrCodeToken) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT
                        u.UserID,
                        u.FullName,
                        u.Email,
                        u.Phone
                    FROM dbo.Users u
                    JOIN dbo.Customers c ON c.CustomerID = u.UserID
                    WHERE u.QrCodeToken = ?
                    """, customerLookupRowMapper(), qrCodeToken);
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "QR code is invalid or customer was not found.");
        }
    }

    private RowMapper<CustomerLookup> customerLookupRowMapper() {
        return (rs, rowNum) -> new CustomerLookup(
                rs.getInt("UserID"),
                rs.getString("FullName"),
                rs.getString("Email"),
                rs.getString("Phone"));
    }

    private RowMapper<MembershipSnapshot> membershipSnapshotRowMapper() {
        return (rs, rowNum) -> new MembershipSnapshot(
                rs.getInt("CustomerMembershipID"),
                rs.getString("Status"),
                toLocalDate(rs, "StartDate"),
                toLocalDate(rs, "EndDate"),
                rs.getString("PlanName"),
                rs.getString("PlanType"));
    }

    private RowMapper<Map<String, Object>> checkinHistoryRowMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("checkInId", rs.getInt("CheckInID"));
            row.put("checkInTime", timestampToIso(rs.getTimestamp("CheckInTime")));
            row.put("customerId", rs.getInt("CustomerID"));
            row.put("fullName", rs.getString("FullName"));
            row.put("email", rs.getString("Email"));
            row.put("phone", rs.getString("Phone"));
            row.put("planName", rs.getString("PlanName"));
            row.put("planType", rs.getString("PlanType"));
            row.put("checkedByUserId", parseInteger(rs.getObject("CheckedByUserID")));
            row.put("checkedByName", rs.getString("CheckedByName"));
            return row;
        };
    }

    private LocalDate toLocalDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date date = rs.getDate(column);
        return date == null ? null : date.toLocalDate();
    }

    private String dateToString(LocalDate value) {
        return value == null ? null : value.format(DATE_FORMAT);
    }

    private String timestampToIso(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant().toString();
    }

    private ResponseStatusException unsupportedAction(String action) {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Unsupported checkin-health action: " + action);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return new LinkedHashMap<>();
    }

    private String asText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private Integer parseInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Integer integer) {
            return integer;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            String text = String.valueOf(value).trim();
            if (text.isEmpty()) {
                return null;
            }
            return Integer.parseInt(text);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Double parseDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Double d) {
            return d;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            String text = String.valueOf(value).trim();
            if (text.isEmpty()) {
                return null;
            }
            return Double.parseDouble(text);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private record CustomerLookup(int customerId, String fullName, String email, String phone) {
    }

    private record MembershipSnapshot(
            int customerMembershipId,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            String planName,
            String planType) {
    }

    private record MembershipValidity(
            boolean valid,
            String reason,
            Integer customerMembershipId,
            String status,
            String planName,
            String planType,
            String startDate,
            String endDate) {
    }
}
