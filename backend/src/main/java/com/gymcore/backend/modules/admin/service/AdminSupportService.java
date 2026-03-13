package com.gymcore.backend.modules.admin.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminSupportService {

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;

    public AdminSupportService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
    }

    public Map<String, Object> searchCustomers(String authorizationHeader, String query) {
        currentUserService.requireAdmin(authorizationHeader);
        String normalizedQuery = trimToNull(query);
        String likeQuery = normalizedQuery == null ? null : "%" + normalizedQuery + "%";

        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (25)
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.IsLocked,
                    membership.Status AS MembershipStatus,
                    membership.PlanName,
                    membership.EndDate,
                    nextSession.SessionDate AS NextSessionDate,
                    nextSession.CoachName,
                    replacement.Status AS ReplacementStatus,
                    notifications.LastNotificationAt
                FROM dbo.Users u
                JOIN dbo.Customers c ON c.CustomerID = u.UserID
                OUTER APPLY (
                    SELECT TOP (1)
                        cm.Status,
                        cm.EndDate,
                        mp.PlanName
                    FROM dbo.CustomerMemberships cm
                    JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                    WHERE cm.CustomerID = u.UserID
                    ORDER BY
                        CASE cm.Status
                            WHEN 'ACTIVE' THEN 0
                            WHEN 'SCHEDULED' THEN 1
                            WHEN 'PENDING' THEN 2
                            ELSE 3
                        END,
                        cm.EndDate DESC,
                        cm.CustomerMembershipID DESC
                ) membership
                OUTER APPLY (
                    SELECT TOP (1)
                        s.SessionDate,
                        coach.FullName AS CoachName
                    FROM dbo.PTSessions s
                    JOIN dbo.Users coach ON coach.UserID = s.CoachID
                    WHERE s.CustomerID = u.UserID
                      AND s.Status = 'SCHEDULED'
                      AND s.SessionDate >= CAST(GETDATE() AS DATE)
                    ORDER BY s.SessionDate ASC, s.PTSessionID ASC
                ) nextSession
                OUTER APPLY (
                    SELECT TOP (1)
                        o.Status
                    FROM dbo.PTSessionReplacementOffers o
                    JOIN dbo.PTSessions s ON s.PTSessionID = o.PTSessionID
                    WHERE s.CustomerID = u.UserID
                    ORDER BY o.CreatedAt DESC, o.OfferID DESC
                ) replacement
                OUTER APPLY (
                    SELECT MAX(n.CreatedAt) AS LastNotificationAt
                    FROM dbo.Notifications n
                    WHERE n.UserID = u.UserID
                ) notifications
                WHERE (? IS NULL
                    OR u.FullName LIKE ?
                    OR u.Email LIKE ?
                    OR u.Phone LIKE ?)
                ORDER BY
                    CASE
                        WHEN ? IS NOT NULL AND u.Email = ? THEN 0
                        WHEN ? IS NOT NULL AND u.Phone = ? THEN 1
                        WHEN ? IS NOT NULL AND u.FullName LIKE ? THEN 2
                        ELSE 3
                    END,
                    notifications.LastNotificationAt DESC,
                    u.CreatedAt DESC,
                    u.UserID DESC
                """, (rs, rowNum) -> mapCustomerSearchItem(rs),
                normalizedQuery, likeQuery, likeQuery, likeQuery,
                normalizedQuery, normalizedQuery, normalizedQuery, normalizedQuery, normalizedQuery, likeQuery);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("query", normalizedQuery);
        response.put("items", items);
        response.put("count", items.size());
        return response;
    }

    public Map<String, Object> getCustomerDetail(String authorizationHeader, int customerId) {
        currentUserService.requireAdmin(authorizationHeader);
        Map<String, Object> account = loadAccount(customerId);
        Map<String, Object> memberships = loadMemberships(customerId);
        Map<String, Object> pt = loadPt(customerId);
        Map<String, Object> orders = loadOrders(customerId);
        Map<String, Object> pickup = loadPickup(customerId);
        Map<String, Object> invoiceEmail = loadInvoiceEmail(customerId);
        Map<String, Object> notifications = loadNotifications(customerId);
        List<Map<String, Object>> alerts = buildAlerts(account, memberships, pt, pickup, invoiceEmail);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("customerId", customerId);
        response.put("account", account);
        response.put("memberships", memberships);
        response.put("pt", pt);
        response.put("orders", orders);
        response.put("pickup", pickup);
        response.put("invoiceEmail", invoiceEmail);
        response.put("notifications", notifications);
        response.put("alerts", alerts);
        response.put("links", Map.of(
                "users", "/admin/users",
                "memberships", "/admin/memberships",
                "coachManagement", "/admin/coach-management",
                "invoices", "/admin/invoices",
                "pickup", "/reception/pickup",
                "notifications", "/notifications"));
        return response;
    }

    private Map<String, Object> loadAccount(int customerId) {
        return jdbcTemplate.query("""
                SELECT TOP (1)
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.IsLocked,
                    u.LockReason,
                    u.CreatedAt
                FROM dbo.Users u
                JOIN dbo.Customers c ON c.CustomerID = u.UserID
                WHERE u.UserID = ?
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("customerId", rs.getInt("UserID"));
            item.put("fullName", rs.getString("FullName"));
            item.put("email", rs.getString("Email"));
            item.put("phone", rs.getString("Phone"));
            item.put("active", rs.getBoolean("IsActive"));
            item.put("locked", rs.getBoolean("IsLocked"));
            item.put("lockReason", rs.getString("LockReason"));
            item.put("createdAt", rs.getTimestamp("CreatedAt"));
            return item;
        }, customerId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found."));
    }

    private Map<String, Object> loadMemberships(int customerId) {
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (6)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType,
                    mp.AllowsCoachBooking
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ?
                ORDER BY
                    CASE cm.Status
                        WHEN 'ACTIVE' THEN 0
                        WHEN 'SCHEDULED' THEN 1
                        WHEN 'PENDING' THEN 2
                        ELSE 3
                    END,
                    cm.EndDate DESC,
                    cm.CustomerMembershipID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("customerMembershipId", rs.getInt("CustomerMembershipID"));
            item.put("status", rs.getString("Status"));
            item.put("startDate", toLocalDate(rs.getDate("StartDate")));
            item.put("endDate", toLocalDate(rs.getDate("EndDate")));
            item.put("planName", rs.getString("PlanName"));
            item.put("planType", rs.getString("PlanType"));
            item.put("allowsCoachBooking", rs.getBoolean("AllowsCoachBooking"));
            return item;
        }, customerId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("current", items.isEmpty() ? Map.of() : items.get(0));
        response.put("history", items);
        return response;
    }

    private Map<String, Object> loadPt(int customerId) {
        List<Map<String, Object>> requests = jdbcTemplate.query("""
                SELECT TOP (5)
                    request.PTRequestID,
                    request.Status,
                    request.StartDate,
                    request.EndDate,
                    request.BookingMode,
                    coach.FullName AS CoachName
                FROM dbo.PTRecurringRequests request
                LEFT JOIN dbo.Users coach ON coach.UserID = request.CoachID
                WHERE request.CustomerID = ?
                ORDER BY request.CreatedAt DESC, request.PTRequestID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ptRequestId", rs.getInt("PTRequestID"));
            item.put("status", rs.getString("Status"));
            item.put("startDate", toLocalDate(rs.getDate("StartDate")));
            item.put("endDate", toLocalDate(rs.getDate("EndDate")));
            item.put("bookingMode", rs.getString("BookingMode"));
            item.put("coachName", rs.getString("CoachName"));
            return item;
        }, customerId);

        List<Map<String, Object>> upcomingSessions = jdbcTemplate.query("""
                SELECT TOP (6)
                    s.PTSessionID,
                    s.SessionDate,
                    s.Status,
                    s.TimeSlotID,
                    ts.SlotIndex,
                    ts.StartTime,
                    ts.EndTime,
                    coach.FullName AS CoachName,
                    replacement.Status AS ReplacementStatus,
                    replacement.Note AS ReplacementNote,
                    replacement.ReplacementCoachName
                FROM dbo.PTSessions s
                JOIN dbo.Users coach ON coach.UserID = s.CoachID
                JOIN dbo.TimeSlots ts ON ts.TimeSlotID = s.TimeSlotID
                OUTER APPLY (
                    SELECT TOP (1)
                        o.Status,
                        o.Note,
                        replacementUser.FullName AS ReplacementCoachName
                    FROM dbo.PTSessionReplacementOffers o
                    JOIN dbo.Users replacementUser ON replacementUser.UserID = o.ReplacementCoachID
                    WHERE o.PTSessionID = s.PTSessionID
                    ORDER BY o.CreatedAt DESC, o.OfferID DESC
                ) replacement
                WHERE s.CustomerID = ?
                ORDER BY
                    CASE WHEN s.SessionDate >= CAST(GETDATE() AS DATE) THEN 0 ELSE 1 END,
                    s.SessionDate ASC,
                    ts.SlotIndex ASC,
                    s.PTSessionID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ptSessionId", rs.getInt("PTSessionID"));
            item.put("sessionDate", toLocalDate(rs.getDate("SessionDate")));
            item.put("status", rs.getString("Status"));
            item.put("timeSlotId", rs.getInt("TimeSlotID"));
            item.put("slotIndex", rs.getInt("SlotIndex"));
            item.put("startTime", toTimeText(rs.getTime("StartTime")));
            item.put("endTime", toTimeText(rs.getTime("EndTime")));
            item.put("coachName", rs.getString("CoachName"));
            item.put("replacementStatus", rs.getString("ReplacementStatus"));
            item.put("replacementNote", rs.getString("ReplacementNote"));
            item.put("replacementCoachName", rs.getString("ReplacementCoachName"));
            return item;
        }, customerId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("currentPhase", requests.stream()
                .filter(item -> {
                    String status = String.valueOf(item.get("status"));
                    return "APPROVED".equalsIgnoreCase(status) || "PENDING".equalsIgnoreCase(status);
                })
                .findFirst()
                .orElse(Map.of()));
        response.put("requests", requests);
        response.put("upcomingSessions", upcomingSessions);
        return response;
    }

    private Map<String, Object> loadOrders(int customerId) {
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (6)
                    o.OrderID,
                    o.Status,
                    o.ShippingFullName,
                    o.ShippingEmail,
                    o.PaymentMethod,
                    invoice.InvoiceID,
                    invoice.InvoiceCode,
                    invoice.TotalAmount,
                    invoice.PaidAt,
                    invoice.PickedUpAt
                FROM dbo.Orders o
                LEFT JOIN dbo.OrderInvoices invoice ON invoice.OrderID = o.OrderID
                WHERE o.CustomerID = ?
                ORDER BY COALESCE(invoice.PaidAt, o.CreatedAt) DESC, o.OrderID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("orderId", rs.getInt("OrderID"));
            item.put("status", rs.getString("Status"));
            item.put("recipientName", rs.getString("ShippingFullName"));
            item.put("recipientEmail", rs.getString("ShippingEmail"));
            item.put("paymentMethod", rs.getString("PaymentMethod"));
            item.put("invoiceId", rs.getObject("InvoiceID"));
            item.put("invoiceCode", rs.getString("InvoiceCode"));
            item.put("totalAmount", rs.getObject("TotalAmount"));
            item.put("paidAt", rs.getTimestamp("PaidAt"));
            item.put("pickedUpAt", rs.getTimestamp("PickedUpAt"));
            return item;
        }, customerId);

        return Map.of("items", items, "count", items.size());
    }

    private Map<String, Object> loadPickup(int customerId) {
        List<Map<String, Object>> awaiting = jdbcTemplate.query("""
                SELECT TOP (5)
                    invoice.InvoiceID,
                    invoice.InvoiceCode,
                    invoice.OrderID,
                    invoice.RecipientName,
                    invoice.PaidAt,
                    invoice.TotalAmount
                FROM dbo.OrderInvoices invoice
                JOIN dbo.Orders o ON o.OrderID = invoice.OrderID
                WHERE o.CustomerID = ?
                  AND invoice.PickedUpAt IS NULL
                ORDER BY invoice.PaidAt DESC, invoice.InvoiceID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("invoiceId", rs.getInt("InvoiceID"));
            item.put("invoiceCode", rs.getString("InvoiceCode"));
            item.put("orderId", rs.getInt("OrderID"));
            item.put("recipientName", rs.getString("RecipientName"));
            item.put("paidAt", rs.getTimestamp("PaidAt"));
            item.put("totalAmount", rs.getObject("TotalAmount"));
            return item;
        }, customerId);

        return Map.of("awaitingPickup", awaiting, "count", awaiting.size());
    }

    private Map<String, Object> loadInvoiceEmail(int customerId) {
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (6)
                    invoice.InvoiceID,
                    invoice.InvoiceCode,
                    invoice.OrderID,
                    invoice.RecipientEmail,
                    invoice.EmailSentAt,
                    invoice.EmailSendError,
                    invoice.PaidAt
                FROM dbo.OrderInvoices invoice
                JOIN dbo.Orders o ON o.OrderID = invoice.OrderID
                WHERE o.CustomerID = ?
                ORDER BY invoice.PaidAt DESC, invoice.InvoiceID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("invoiceId", rs.getInt("InvoiceID"));
            item.put("invoiceCode", rs.getString("InvoiceCode"));
            item.put("orderId", rs.getInt("OrderID"));
            item.put("recipientEmail", rs.getString("RecipientEmail"));
            item.put("emailSentAt", rs.getTimestamp("EmailSentAt"));
            item.put("emailSendError", rs.getString("EmailSendError"));
            item.put("paidAt", rs.getTimestamp("PaidAt"));
            return item;
        }, customerId);

        long failureCount = items.stream()
                .filter(item -> item.get("emailSendError") != null && item.get("emailSentAt") == null)
                .count();

        return Map.of("items", items, "failureCount", failureCount);
    }

    private Map<String, Object> loadNotifications(int customerId) {
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (8)
                    NotificationID,
                    NotificationType,
                    Title,
                    Message,
                    LinkUrl,
                    IsRead,
                    CreatedAt
                FROM dbo.Notifications
                WHERE UserID = ?
                ORDER BY CreatedAt DESC, NotificationID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("notificationId", rs.getInt("NotificationID"));
            item.put("type", rs.getString("NotificationType"));
            item.put("title", rs.getString("Title"));
            item.put("message", rs.getString("Message"));
            item.put("linkUrl", rs.getString("LinkUrl"));
            item.put("read", rs.getBoolean("IsRead"));
            item.put("createdAt", rs.getTimestamp("CreatedAt"));
            return item;
        }, customerId);

        long unreadCount = items.stream().filter(item -> !Boolean.TRUE.equals(item.get("read"))).count();
        Timestamp lastCreatedAt = items.isEmpty() ? null : (Timestamp) items.get(0).get("createdAt");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("unreadCount", unreadCount);
        response.put("lastCreatedAt", lastCreatedAt);
        return response;
    }

    private List<Map<String, Object>> buildAlerts(
            Map<String, Object> account,
            Map<String, Object> memberships,
            Map<String, Object> pt,
            Map<String, Object> pickup,
            Map<String, Object> invoiceEmail) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        if (Boolean.TRUE.equals(account.get("locked"))) {
            alerts.add(alert("locked-account", "warning", "Customer account is locked.", "/admin/users"));
        }

        Object membershipStatusValue = ((Map<?, ?>) memberships.getOrDefault("current", Map.of())).get("status");
        String membershipStatus = membershipStatusValue == null ? "" : String.valueOf(membershipStatusValue);
        if (!membershipStatus.isBlank() && !"ACTIVE".equalsIgnoreCase(membershipStatus)) {
            alerts.add(alert("membership", "warning", "Current membership is not active.", "/admin/memberships"));
        }

        long pickupCount = ((Number) pickup.getOrDefault("count", 0)).longValue();
        if (pickupCount > 0) {
            alerts.add(alert("pickup", "info", pickupCount + " paid order(s) still await pickup.", "/reception/pickup"));
        }

        long invoiceFailureCount = ((Number) invoiceEmail.getOrDefault("failureCount", 0)).longValue();
        if (invoiceFailureCount > 0) {
            alerts.add(alert("invoice-email", "warning", invoiceFailureCount + " invoice email delivery issue(s) need review.", "/admin/invoices"));
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) pt.getOrDefault("upcomingSessions", List.of());
        boolean hasPendingReplacement = sessions.stream().anyMatch(session ->
                "PENDING_CUSTOMER".equalsIgnoreCase(String.valueOf(session.get("replacementStatus"))));
        if (hasPendingReplacement) {
            alerts.add(alert("replacement", "info", "A replacement-coach decision is pending from the customer.", "/admin/coach-management"));
        }
        return alerts;
    }

    private static Map<String, Object> alert(String id, String severity, String message, String route) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("severity", severity);
        item.put("message", message);
        item.put("route", route);
        return item;
    }

    private static Map<String, Object> mapCustomerSearchItem(ResultSet rs) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("customerId", rs.getInt("UserID"));
        item.put("fullName", rs.getString("FullName"));
        item.put("email", rs.getString("Email"));
        item.put("phone", rs.getString("Phone"));
        item.put("active", rs.getBoolean("IsActive"));
        item.put("locked", rs.getBoolean("IsLocked"));
        item.put("membershipStatus", rs.getString("MembershipStatus"));
        item.put("planName", rs.getString("PlanName"));
        item.put("membershipEndDate", toLocalDate(rs.getDate("EndDate")));
        item.put("nextSessionDate", toLocalDate(rs.getDate("NextSessionDate")));
        item.put("coachName", rs.getString("CoachName"));
        item.put("replacementStatus", rs.getString("ReplacementStatus"));
        item.put("lastNotificationAt", rs.getTimestamp("LastNotificationAt"));
        return item;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String toLocalDate(Date value) {
        return value == null ? null : value.toLocalDate().toString();
    }

    private static String toTimeText(java.sql.Time value) {
        return value == null ? null : value.toString();
    }
}
