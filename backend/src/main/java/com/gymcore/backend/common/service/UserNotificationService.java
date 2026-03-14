package com.gymcore.backend.common.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class UserNotificationService {

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;

    public UserNotificationService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
    }

    public void notifyUser(int userId, String type, String title, String message, String linkUrl, Integer refId,
            String extraKey) {
        jdbcTemplate.update("""
                INSERT INTO dbo.Notifications (UserID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey)
                SELECT ?, ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM dbo.Notifications n
                    WHERE n.UserID = ?
                      AND n.NotificationType = ?
                      AND ((n.RefId = ?) OR (n.RefId IS NULL AND ? IS NULL))
                      AND ((n.ExtraKey = ?) OR (n.ExtraKey IS NULL AND ? IS NULL))
                )
                """, userId, type, title, message, linkUrl, refId, extraKey,
                userId, type, refId, refId, extraKey, extraKey);
    }

    public void notifyAllCustomers(String type, String title, String message, String linkUrl, Integer refId,
            String extraKey) {
        jdbcTemplate.update("""
                INSERT INTO dbo.Notifications (UserID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey)
                SELECT u.UserID, ?, ?, ?, ?, ?, ?
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                WHERE r.RoleName = N'Customer'
                  AND u.IsActive = 1
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dbo.Notifications n
                      WHERE n.UserID = u.UserID
                        AND n.NotificationType = ?
                        AND ((n.RefId = ?) OR (n.RefId IS NULL AND ? IS NULL))
                        AND ((n.ExtraKey = ?) OR (n.ExtraKey IS NULL AND ? IS NULL))
                  )
                """, type, title, message, linkUrl, refId, extraKey,
                type, refId, refId, extraKey, extraKey);
    }

    public Map<String, Object> getCurrentUserNotifications(String authorizationHeader, boolean unreadOnly) {
        return getCurrentUserNotifications(authorizationHeader, unreadOnly, "all");
    }

    public Map<String, Object> getCurrentUserNotifications(String authorizationHeader, boolean unreadOnly, String view) {
        CurrentUserService.UserInfo user = currentUserService.requireUser(authorizationHeader);
        String sql = """
                SELECT NotificationID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey, IsRead, CreatedAt
                FROM dbo.Notifications
                WHERE UserID = ?
                  AND (? = 0 OR IsRead = 0)
                ORDER BY CreatedAt DESC, NotificationID DESC
                """;
        List<Map<String, Object>> notifications = jdbcTemplate.query(sql, this::mapNotification, user.userId(),
                unreadOnly ? 1 : 0);
        ReminderFeedView requestedView = ReminderFeedView.from(view);
        List<Map<String, Object>> actionable = notifications.stream()
                .filter(notification -> notificationHasBucket(notification, ReminderBucket.ACTIONABLE))
                .toList();
        List<Map<String, Object>> history = notifications.stream()
                .filter(notification -> notificationHasBucket(notification, ReminderBucket.HISTORY))
                .toList();
        List<Map<String, Object>> selectedNotifications = switch (requestedView) {
            case ACTIONABLE -> actionable;
            case HISTORY -> history;
            case ALL -> notifications;
        };
        long unreadCount = notifications.stream().filter(item -> !Boolean.TRUE.equals(item.get("isRead"))).count();

        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("total", notifications.size());
        counts.put("actionable", actionable.size());
        counts.put("history", history.size());
        counts.put("unread", unreadCount);
        counts.put("unreadActionable", actionable.stream()
                .filter(item -> !Boolean.TRUE.equals(item.get("isRead")))
                .count());

        Map<String, Object> reminderCenter = new LinkedHashMap<>();
        reminderCenter.put("actionable", actionable);
        reminderCenter.put("history", history);
        reminderCenter.put("counts", counts);

        Map<String, Object> appliedFilters = new LinkedHashMap<>();
        appliedFilters.put("unreadOnly", unreadOnly);
        appliedFilters.put("view", requestedView.apiValue());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("notifications", selectedNotifications);
        response.put("unreadCount", unreadCount);
        response.put("reminderCenter", reminderCenter);
        response.put("appliedFilters", appliedFilters);
        return response;
    }

    public Map<String, Object> markNotificationReadState(String authorizationHeader, int notificationId, boolean isRead) {
        CurrentUserService.UserInfo user = currentUserService.requireUser(authorizationHeader);
        int updated = jdbcTemplate.update("""
                UPDATE dbo.Notifications
                SET IsRead = ?
                WHERE NotificationID = ? AND UserID = ?
                """, isRead, notificationId, user.userId());
        return Map.of(
                "success", updated > 0,
                "notificationId", notificationId,
                "isRead", isRead);
    }

    public Map<String, Object> markAllNotificationsRead(String authorizationHeader) {
        CurrentUserService.UserInfo user = currentUserService.requireUser(authorizationHeader);
        int updated = jdbcTemplate.update("""
                UPDATE dbo.Notifications
                SET IsRead = 1
                WHERE UserID = ? AND IsRead = 0
                """, user.userId());
        return Map.of(
                "success", true,
                "updatedCount", updated);
    }

    private Map<String, Object> mapNotification(ResultSet rs, int rowNum) throws SQLException {
        Map<String, Object> notification = new LinkedHashMap<>();
        notification.put("notificationId", rs.getInt("NotificationID"));
        String type = rs.getString("NotificationType");
        notification.put("type", type);
        notification.put("title", rs.getString("Title"));
        notification.put("message", rs.getString("Message"));
        String linkUrl = rs.getString("LinkUrl");
        notification.put("linkUrl", linkUrl);
        int refId = rs.getInt("RefId");
        notification.put("refId", rs.wasNull() ? null : refId);
        notification.put("extraKey", rs.getString("ExtraKey"));
        boolean isRead = rs.getBoolean("IsRead");
        notification.put("isRead", isRead);
        Timestamp createdAt = rs.getTimestamp("CreatedAt");
        notification.put("createdAt", createdAt == null ? null : createdAt.toInstant().toString());
        notification.put("reminder", buildReminderProjection(type, isRead, linkUrl));
        return notification;
    }

    private boolean notificationHasBucket(Map<String, Object> notification, ReminderBucket bucket) {
        Object reminder = notification.get("reminder");
        if (!(reminder instanceof Map<?, ?> reminderMap)) {
            return false;
        }
        return bucket.apiValue().equals(reminderMap.get("bucket"));
    }

    private Map<String, Object> buildReminderProjection(String type, boolean isRead, String linkUrl) {
        ReminderIntent intent = resolveReminderIntent(type);
        ReminderCategory category = resolveReminderCategory(type, linkUrl);
        ReminderBucket bucket = isRead || intent == ReminderIntent.INFORMATIONAL
                ? ReminderBucket.HISTORY
                : ReminderBucket.ACTIONABLE;

        Map<String, Object> reminder = new LinkedHashMap<>();
        reminder.put("intent", intent.apiValue());
        reminder.put("bucket", bucket.apiValue());
        reminder.put("category", category.apiValue());
        reminder.put("keepInHistory", true);
        reminder.put("destination", buildDestinationProjection(type, linkUrl));
        return reminder;
    }

    private Map<String, Object> buildDestinationProjection(String type, String linkUrl) {
        Map<String, Object> destination = new LinkedHashMap<>();
        destination.put("href", linkUrl);
        destination.put("kind", resolveDestinationKind(linkUrl));
        destination.put("label", resolveDestinationLabel(type, linkUrl));
        return destination;
    }

    private ReminderIntent resolveReminderIntent(String type) {
        if (type == null || type.isBlank()) {
            return ReminderIntent.INFORMATIONAL;
        }
        if (type.startsWith("MEMBERSHIP_EXPIRES")
                || type.contains("PICKUP")
                || "PROMOTION_POST_PUBLISHED".equals(type)
                || "PT_REPLACEMENT_OFFER".equals(type)
                || "PT_REQUEST_CREATED".equals(type)
                || "PT_RESCHEDULE_REQUESTED".equals(type)
                || "PT_SESSION_CANCELLED_BY_COACH".equals(type)
                || "PT_REQUEST_DENIED".equals(type)
                || "PT_RESCHEDULE_DENIED".equals(type)) {
            return ReminderIntent.ACTION_REQUIRED;
        }
        return ReminderIntent.INFORMATIONAL;
    }

    private ReminderCategory resolveReminderCategory(String type, String linkUrl) {
        if (type != null && type.startsWith("MEMBERSHIP")) {
            return ReminderCategory.MEMBERSHIP;
        }
        if (type != null && (type.startsWith("ORDER") || type.startsWith("COUPON"))) {
            return ReminderCategory.COMMERCE;
        }
        if (type != null && (type.startsWith("PROMOTION") || type.startsWith("COUPON"))) {
            return ReminderCategory.PROMOTION;
        }
        if (type != null && type.startsWith("PT_")) {
            return ReminderCategory.PT;
        }
        if (linkUrl != null && linkUrl.contains("/promotions")) {
            return ReminderCategory.PROMOTION;
        }
        return ReminderCategory.GENERAL;
    }

    private String resolveDestinationKind(String linkUrl) {
        if (linkUrl == null || linkUrl.isBlank()) {
            return "GENERIC";
        }
        if (linkUrl.contains("/promotions")) {
            return "PROMOTIONS";
        }
        if (linkUrl.contains("/membership")) {
            return "MEMBERSHIP";
        }
        if (linkUrl.contains("/orders") || linkUrl.contains("/shop")) {
            return "COMMERCE";
        }
        if (linkUrl.contains("/coach/")) {
            return "COACH";
        }
        if (linkUrl.contains("/customer/coach-booking")) {
            return "PT";
        }
        return "GENERIC";
    }

    private String resolveDestinationLabel(String type, String linkUrl) {
        if ("PROMOTION_POST_PUBLISHED".equals(type) || (linkUrl != null && linkUrl.contains("/promotions"))) {
            return "Open promotions";
        }
        if (type != null && type.startsWith("MEMBERSHIP")) {
            return "View membership";
        }
        if (type != null && (type.startsWith("ORDER") || type.startsWith("COUPON"))) {
            return "Open commerce";
        }
        if ("PT_REQUEST_CREATED".equals(type) || (linkUrl != null && linkUrl.contains("/coach/booking-requests"))) {
            return "Review request";
        }
        if (linkUrl != null && linkUrl.contains("/coach/schedule")) {
            return "Open coach schedule";
        }
        if (type != null && type.startsWith("PT_")) {
            return "Open PT schedule";
        }
        return "Open notification";
    }

    private enum ReminderFeedView {
        ALL("all"),
        ACTIONABLE("actionable"),
        HISTORY("history");

        private final String apiValue;

        ReminderFeedView(String apiValue) {
            this.apiValue = apiValue;
        }

        private String apiValue() {
            return apiValue;
        }

        private static ReminderFeedView from(String value) {
            if (value == null || value.isBlank()) {
                return ALL;
            }
            for (ReminderFeedView candidate : values()) {
                if (candidate.apiValue.equalsIgnoreCase(value.trim())) {
                    return candidate;
                }
            }
            return ALL;
        }
    }

    private enum ReminderIntent {
        ACTION_REQUIRED("ACTION_REQUIRED"),
        INFORMATIONAL("INFORMATIONAL");

        private final String apiValue;

        ReminderIntent(String apiValue) {
            this.apiValue = apiValue;
        }

        private String apiValue() {
            return apiValue;
        }
    }

    private enum ReminderBucket {
        ACTIONABLE("ACTIONABLE"),
        HISTORY("HISTORY");

        private final String apiValue;

        ReminderBucket(String apiValue) {
            this.apiValue = apiValue;
        }

        private String apiValue() {
            return apiValue;
        }
    }

    private enum ReminderCategory {
        MEMBERSHIP("MEMBERSHIP"),
        COMMERCE("COMMERCE"),
        PROMOTION("PROMOTION"),
        PT("PT"),
        GENERAL("GENERAL");

        private final String apiValue;

        ReminderCategory(String apiValue) {
            this.apiValue = apiValue;
        }

        private String apiValue() {
            return apiValue;
        }
    }
}
