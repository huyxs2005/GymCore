package com.gymcore.backend.modules.content.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class GoalAdminServiceTest {

    private JdbcTemplate jdbcTemplate;
    private GoalAdminService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        CurrentUserService currentUserService = Mockito.mock(CurrentUserService.class);
        service = new GoalAdminService(jdbcTemplate, currentUserService);
    }

    @Test
    void createGoal_shouldRejectDuplicateGoalCode() {
        when(jdbcTemplate.queryForObject(anyString(), ArgumentMatchers.eq(Integer.class), any(), any(), any()))
                .thenReturn(1);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.createGoal("Bearer admin", Map.of(
                        "goalCode", "gain muscle",
                        "name", "Gain muscle",
                        "workoutIds", List.of(),
                        "foodIds", List.of())));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Goal code already exists.", exception.getReason());
    }
}
