package com.gymcore.backend.modules.users.service;

import com.gymcore.backend.modules.auth.service.AuthService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserManagementService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final JdbcTemplate jdbcTemplate;
    private final AuthService authService;

    public UserManagementService(JdbcTemplate jdbcTemplate, AuthService authService) {
        this.jdbcTemplate = jdbcTemplate;
        this.authService = authService;
    }

    public Map<String, Object> execute(String action, Object payload) {
        return switch (action) {
            case "reception-search-customers" -> receptionSearchCustomers(asMap(payload));
            case "reception-customer-membership" -> receptionCustomerMembership(asMap(payload));
            default -> todo(action, payload);
        };
    }

    private Map<String, Object> receptionSearchCustomers(Map<String, Object> payload) {
        requireReceptionist(payload);
        String query = asText(payload.get("query"));
        if (query == null) {
            return Map.of("items", List.of());
        }

        String like = "%" + query + "%";
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (20)
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    latest.CustomerMembershipID,
                    latest.Status,
                    latest.StartDate,
                    latest.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.Users u
                JOIN dbo.Customers c ON c.CustomerID = u.UserID
                OUTER APPLY (
                    SELECT TOP (1)
                        cm.CustomerMembershipID,
                        cm.MembershipPlanID,
                        cm.Status,
                        cm.StartDate,
                        cm.EndDate
                    FROM dbo.CustomerMemberships cm
                    WHERE cm.CustomerID = u.UserID
                    ORDER BY
                        CASE cm.Status
                            WHEN 'ACTIVE' THEN 1
                            WHEN 'SCHEDULED' THEN 2
                            WHEN 'PENDING' THEN 3
                            WHEN 'EXPIRED' THEN 4
                            WHEN 'CANCELLED' THEN 5
                            ELSE 6
                        END,
                        cm.EndDate DESC,
                        cm.CustomerMembershipID DESC
                ) latest
                LEFT JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = latest.MembershipPlanID
                WHERE
                    u.FullName LIKE ?
                    OR u.Email LIKE ?
                    OR u.Phone LIKE ?
                    OR u.PhoneNormalized LIKE ?
                ORDER BY u.FullName ASC, u.UserID ASC
                """, searchRowMapper(), like, like, like, like);
        return Map.of("items", items);
    }

    private Map<String, Object> receptionCustomerMembership(Map<String, Object> payload) {
        requireReceptionist(payload);
        Integer customerId = parseInteger(payload.get("customerId"));
        if (customerId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customerId is required.");
        }

        CustomerLookup customer = jdbcTemplate.query("""
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone
                FROM dbo.Users u
                JOIN dbo.Customers c ON c.CustomerID = u.UserID
                WHERE u.UserID = ?
                """, customerLookupRowMapper(), customerId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found."));

        MembershipValidity validity = buildMembershipValidity(customer.customerId());

        Map<String, Object> customerMap = new LinkedHashMap<>();
        customerMap.put("customerId", customer.customerId());
        customerMap.put("fullName", customer.fullName());
        customerMap.put("email", customer.email());
        customerMap.put("phone", customer.phone());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("customer", customerMap);
        data.put("validForCheckin", validity.valid());
        data.put("reason", validity.reason());

        if (validity.customerMembershipId() == null) {
            data.put("membership", Map.of());
        } else {
            Map<String, Object> membership = new LinkedHashMap<>();
            membership.put("customerMembershipId", validity.customerMembershipId());
            membership.put("status", validity.status());
            membership.put("planName", validity.planName());
            membership.put("planType", validity.planType());
            membership.put("startDate", validity.startDate());
            membership.put("endDate", validity.endDate());
            if (validity.daysUntilActive() != null) {
                membership.put("daysUntilActive", validity.daysUntilActive());
            }
            data.put("membership", membership);
        }
        return data;
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
        MembershipSnapshot active = findTopMembership(customerId, "ACTIVE");
        if (active != null) {
            return new MembershipValidity(
                    true,
                    null,
                    active.customerMembershipId(),
                    active.status(),
                    active.planName(),
                    active.planType(),
                    dateToString(active.startDate()),
                    dateToString(active.endDate()),
                    null
            );
        }

        MembershipSnapshot scheduled = findTopMembership(customerId, "SCHEDULED");
        if (scheduled != null) {
            int days = Math.max(0, (int) java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), scheduled.startDate()));
            return new MembershipValidity(
                    false,
                    "Membership not active yet. It is scheduled to start on " + dateToString(scheduled.startDate()) + ".",
                    scheduled.customerMembershipId(),
                    scheduled.status(),
                    scheduled.planName(),
                    scheduled.planType(),
                    dateToString(scheduled.startDate()),
                    dateToString(scheduled.endDate()),
                    days
            );
        }

        MembershipSnapshot expired = findTopMembership(customerId, "EXPIRED");
        if (expired != null) {
            return new MembershipValidity(
                    false,
                    "Membership expired on " + dateToString(expired.endDate()) + ".",
                    expired.customerMembershipId(),
                    expired.status(),
                    expired.planName(),
                    expired.planType(),
                    dateToString(expired.startDate()),
                    dateToString(expired.endDate()),
                    null
            );
        }

        MembershipSnapshot pending = findTopMembership(customerId, "PENDING");
        if (pending != null) {
            return new MembershipValidity(
                    false,
                    "Membership payment is pending and not active yet.",
                    pending.customerMembershipId(),
                    pending.status(),
                    pending.planName(),
                    pending.planType(),
                    dateToString(pending.startDate()),
                    dateToString(pending.endDate()),
                    null
            );
        }

        return new MembershipValidity(false, "Customer does not have a valid membership.", null, null, null, null, null, null, null);
    }

    private MembershipSnapshot findTopMembership(int customerId, String status) {
        List<MembershipSnapshot> rows = jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.Status = ?
                ORDER BY cm.EndDate DESC, cm.CustomerMembershipID DESC
                """, membershipSnapshotRowMapper(), customerId, status);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private RowMapper<Map<String, Object>> searchRowMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("customerId", rs.getInt("UserID"));
            item.put("fullName", rs.getString("FullName"));
            item.put("email", rs.getString("Email"));
            item.put("phone", rs.getString("Phone"));

            Integer membershipId = parseInteger(rs.getObject("CustomerMembershipID"));
            if (membershipId != null) {
                Map<String, Object> membership = new LinkedHashMap<>();
                membership.put("customerMembershipId", membershipId);
                membership.put("status", rs.getString("Status"));
                membership.put("planName", rs.getString("PlanName"));
                membership.put("planType", rs.getString("PlanType"));
                membership.put("startDate", dateToString(toLocalDate(rs, "StartDate")));
                membership.put("endDate", dateToString(toLocalDate(rs, "EndDate")));
                item.put("membership", membership);
            } else {
                item.put("membership", Map.of());
            }
            return item;
        };
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

    private LocalDate toLocalDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date date = rs.getDate(column);
        return date == null ? null : date.toLocalDate();
    }

    private String dateToString(LocalDate value) {
        return value == null ? null : value.format(DATE_FORMAT);
    }

    private Map<String, Object> todo(String action, Object payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("module", "users");
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
            String endDate,
            Integer daysUntilActive
    ) {
    }
}
