package com.gymcore.backend.modules.checkin.service;

import com.gymcore.backend.modules.auth.service.AuthService;
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
            case "reception-scan-checkin" -> receptionScanCheckin(asMap(payload));
            case "reception-validate-membership" -> receptionValidateMembership(asMap(payload));
            case "reception-get-checkin-history" -> receptionGetCheckinHistory(asMap(payload));
            default -> todo(action, payload);
        };
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-in failed. Membership is not valid for check-in.");
        }

        Map<String, Object> latest = jdbcTemplate.queryForObject("""
                SELECT TOP (1)
                    ci.CheckInID,
                    ci.CheckInTime
                FROM dbo.CheckIns ci
                WHERE ci.CustomerID = ? AND ci.CustomerMembershipID = ? AND ci.CheckedByUserID = ?
                ORDER BY ci.CheckInID DESC
                """, (rs, rowNum) -> Map.of(
                        "checkInId", rs.getInt("CheckInID"),
                        "checkInTime", timestampToIso(rs.getTimestamp("CheckInTime"))
                ), customer.customerId(), validity.customerMembershipId(), receptionist.userId());

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
                "fullName", receptionist.fullName()
        ));

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
                    "endDate", validity.endDate() == null ? "" : validity.endDate()
            ));
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
                    dateToString(active.endDate())
            );
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
            String reason = "Membership not active yet. It is scheduled to start on " + dateToString(scheduled.startDate()) + ".";
            return new MembershipValidity(
                    false,
                    reason,
                    scheduled.customerMembershipId(),
                    scheduled.status(),
                    scheduled.planName(),
                    scheduled.planType(),
                    dateToString(scheduled.startDate()),
                    dateToString(scheduled.endDate())
            );
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
                    dateToString(expired.endDate())
            );
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
                    dateToString(pending.endDate())
            );
        }

        return new MembershipValidity(false, "Customer does not have a valid membership.", null, null, null, null, null, null);
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
                rs.getString("Phone")
        );
    }

    private RowMapper<MembershipSnapshot> membershipSnapshotRowMapper() {
        return (rs, rowNum) -> new MembershipSnapshot(
                rs.getInt("CustomerMembershipID"),
                rs.getString("Status"),
                toLocalDate(rs, "StartDate"),
                toLocalDate(rs, "EndDate"),
                rs.getString("PlanName"),
                rs.getString("PlanType")
        );
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

    private Map<String, Object> todo(String action, Object payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("module", "checkin-health");
        response.put("action", action);
        response.put("status", "TODO");
        response.put("payload", payload == null ? Map.of() : payload);
        return response;
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

    private record CustomerLookup(int customerId, String fullName, String email, String phone) {
    }

    private record MembershipSnapshot(
            int customerMembershipId,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            String planName,
            String planType
    ) {
    }

    private record MembershipValidity(
            boolean valid,
            String reason,
            Integer customerMembershipId,
            String status,
            String planName,
            String planType,
            String startDate,
            String endDate
    ) {
    }
}
