package com.gymcore.backend.modules.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class AdminServiceCoachInsightsTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private AdminService adminService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        adminService = new AdminService(jdbcTemplate, currentUserService);
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
    }

    @Test
    void getCoachFeedback_shouldReturnRankedItems() {
        when(jdbcTemplate.query(contains("FROM dbo.Coaches c"), any(RowMapper.class)))
                .thenReturn(List.of(
                        Map.of("coachId", 1, "coachName", "Coach A", "averageRating", 4.9, "reviewCount", 18),
                        Map.of("coachId", 2, "coachName", "Coach B", "averageRating", 4.5, "reviewCount", 10)));

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) adminService.execute("get-coach-feedback", "Bearer admin", null);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertEquals(2, items.size());
        assertEquals(1, items.getFirst().get("coachId"));
    }

    @Test
    void getCoachStudents_shouldReturnEmptyWhenNoSessions() {
        when(jdbcTemplate.query(contains("StudentCount"), any(RowMapper.class)))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) adminService.execute("get-coach-students", "Bearer admin", null);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertTrue(items.isEmpty());
    }

    @Test
    void getProductRevenue_shouldRejectInvalidDateFormat() {
        ResponseStatusException exception = org.junit.jupiter.api.Assertions.assertThrows(
                ResponseStatusException.class,
                () -> adminService.execute("get-product-revenue", "Bearer admin", Map.of("from", "2026/03/01")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("Invalid date format"));
    }
}
