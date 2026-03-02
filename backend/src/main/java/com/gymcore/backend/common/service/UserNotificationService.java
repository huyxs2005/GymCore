package com.gymcore.backend.common.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
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
        long unreadCount = notifications.stream().filter(item -> !Boolean.TRUE.equals(item.get("isRead"))).count();
        return Map.of(
                "notifications", notifications,
                "unreadCount", unreadCount);
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
        notification.put("type", rs.getString("NotificationType"));
        notification.put("title", rs.getString("Title"));
        notification.put("message", rs.getString("Message"));
        notification.put("linkUrl", rs.getString("LinkUrl"));
        int refId = rs.getInt("RefId");
        notification.put("refId", rs.wasNull() ? null : refId);
        notification.put("extraKey", rs.getString("ExtraKey"));
        notification.put("isRead", rs.getBoolean("IsRead"));
        Timestamp createdAt = rs.getTimestamp("CreatedAt");
        notification.put("createdAt", createdAt == null ? null : createdAt.toInstant().toString());
        return notification;
    }
}
