package com.gymcore.backend.common.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class UserNotificationServiceTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private UserNotificationService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        service = new UserNotificationService(jdbcTemplate, currentUserService);
    }

    @Test
    void getCurrentUserNotifications_shouldBuildReminderCenterWithHistoryPreserved() throws Exception {
        when(currentUserService.requireUser("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(7, "Customer", "CUSTOMER"));
        stubNotificationQuery(false, List.of(
                notificationRow(41, "MEMBERSHIP_EXPIRES_COUNTDOWN", false, "/customer/current-membership",
                        "Membership expires soon", "Your plan expires in 3 days."),
                notificationRow(42, "ORDER_PAYMENT_SUCCESS", false, "/customer/orders",
                        "Order paid", "Your order payment was confirmed."),
                notificationRow(43, "PT_REPLACEMENT_OFFER", true, "/customer/coach-booking",
                        "Replacement coach offered", "Please review the replacement offer.")));

        Map<String, Object> response = service.getCurrentUserNotifications("Bearer customer", false, "all");

        assertEquals(3, list(response, "notifications").size());
        assertEquals(2L, response.get("unreadCount"));

        Map<String, Object> membershipReminder = list(response, "notifications").get(0);
        assertEquals("ACTION_REQUIRED", nestedReminder(membershipReminder).get("intent"));
        assertEquals("ACTIONABLE", nestedReminder(membershipReminder).get("bucket"));
        assertEquals("View membership", destination(membershipReminder).get("label"));

        Map<String, Object> paymentHistory = list(response, "notifications").get(1);
        assertEquals("INFORMATIONAL", nestedReminder(paymentHistory).get("intent"));
        assertEquals("HISTORY", nestedReminder(paymentHistory).get("bucket"));

        Map<String, Object> readReplacement = list(response, "notifications").get(2);
        assertEquals("ACTION_REQUIRED", nestedReminder(readReplacement).get("intent"));
        assertEquals("HISTORY", nestedReminder(readReplacement).get("bucket"));

        Map<String, Object> reminderCenter = map(response, "reminderCenter");
        assertEquals(1, list(reminderCenter, "actionable").size());
        assertEquals(2, list(reminderCenter, "history").size());
        assertEquals(3, map(reminderCenter, "counts").get("total"));
        assertEquals(1, map(reminderCenter, "counts").get("actionable"));
        assertEquals(2, map(reminderCenter, "counts").get("history"));
    }

    @Test
    void getCurrentUserNotifications_shouldSupportActionableViewWithoutDroppingHistoryBuckets() throws Exception {
        when(currentUserService.requireUser("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(7, "Customer", "CUSTOMER"));
        stubNotificationQuery(false, List.of(
                notificationRow(51, "PROMOTION_POST_PUBLISHED", false, "/customer/promotions",
                        "New promotion available", "Open promotions to claim it before it expires."),
                notificationRow(52, "COUPON_CLAIMED", false, "/customer/promotions",
                        "Coupon added", "Your coupon is in wallet."),
                notificationRow(53, "PT_REPLACEMENT_OFFER", true, "/customer/coach-booking",
                        "Replacement coach offered", "Please review the replacement offer.")));

        Map<String, Object> response = service.getCurrentUserNotifications("Bearer customer", false, "actionable");

        List<Map<String, Object>> notifications = list(response, "notifications");
        assertEquals(1, notifications.size());
        assertEquals("PROMOTION_POST_PUBLISHED", notifications.get(0).get("type"));
        assertEquals("actionable", map(response, "appliedFilters").get("view"));

        Map<String, Object> reminderCenter = map(response, "reminderCenter");
        assertEquals(1, list(reminderCenter, "actionable").size());
        assertEquals(2, list(reminderCenter, "history").size());
        assertTrue(list(reminderCenter, "history").stream()
                .anyMatch(item -> Integer.valueOf(53).equals(item.get("notificationId"))));
    }

    private void stubNotificationQuery(boolean unreadOnly, List<Map<String, Object>> rows) throws Exception {
        when(jdbcTemplate.query(
                contains("FROM dbo.Notifications"),
                any(RowMapper.class),
                eq(7),
                eq(unreadOnly ? 1 : 0)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    java.util.ArrayList<Object> mapped = new java.util.ArrayList<>();
                    for (int index = 0; index < rows.size(); index++) {
                        mapped.add(mapper.mapRow(resultSet(rows.get(index)), index));
                    }
                    return mapped;
                });
    }

    private Map<String, Object> notificationRow(int id, String type, boolean isRead, String linkUrl, String title,
            String message) {
        Map<String, Object> row = new HashMap<>();
        row.put("NotificationID", id);
        row.put("NotificationType", type);
        row.put("Title", title);
        row.put("Message", message);
        row.put("LinkUrl", linkUrl);
        row.put("RefId", id * 10);
        row.put("ExtraKey", type + "_" + id);
        row.put("IsRead", isRead);
        row.put("CreatedAt", Timestamp.valueOf("2026-03-13 10:00:00"));
        return row;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> list(Map<String, Object> source, String key) {
        return (List<Map<String, Object>>) source.get(key);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Map<String, Object> source, String key) {
        return (Map<String, Object>) source.get(key);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> nestedReminder(Map<String, Object> notification) {
        return (Map<String, Object>) notification.get("reminder");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> destination(Map<String, Object> notification) {
        return (Map<String, Object>) nestedReminder(notification).get("destination");
    }

    private ResultSet resultSet(Map<String, Object> values) throws Exception {
        ResultSet rs = Mockito.mock(ResultSet.class);
        AtomicBoolean lastWasNull = new AtomicBoolean(false);

        when(rs.getString(any())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value == null ? null : String.valueOf(value);
        });
        when(rs.getInt(any())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            boolean isNull = value == null;
            lastWasNull.set(isNull);
            return isNull ? 0 : ((Number) value).intValue();
        });
        when(rs.wasNull()).thenAnswer(invocation -> lastWasNull.get());
        when(rs.getBoolean(any())).thenAnswer(invocation -> Boolean.TRUE.equals(values.get(invocation.getArgument(0))));
        when(rs.getTimestamp(any())).thenAnswer(invocation -> (Timestamp) values.get(invocation.getArgument(0)));
        return rs;
    }
}
