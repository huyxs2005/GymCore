package com.gymcore.backend.modules.content.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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

class ContentAdminServiceTest {

    private JdbcTemplate jdbcTemplate;
    private ContentAdminService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        CurrentUserService currentUserService = Mockito.mock(CurrentUserService.class);
        service = new ContentAdminService(jdbcTemplate, currentUserService);
    }

    @Test
    void createFood_shouldRejectNegativeProtein() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.createFood("Bearer admin", Map.of(
                        "name", "Greek Yogurt",
                        "protein", -1,
                        "categoryIds", List.of(1))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Protein must be a non-negative number.", exception.getReason());
    }

    @Test
    void createWorkout_shouldRejectInvalidWorkoutCategoryIds() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), ArgumentMatchers.<Object[]>any()))
                .thenReturn(0);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.createWorkout("Bearer admin", Map.of(
                        "name", "Push-up",
                        "instructions", "Keep body straight.",
                        "categoryIds", List.of(999))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("One or more workout categories are invalid.", exception.getReason());
    }

    @Test
    void updateFood_shouldRejectNonNumericCategoryIds() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.updateFood("Bearer admin", 5, Map.of(
                        "name", "Chicken Breast",
                        "recipe", "Grill it.",
                        "categoryIds", List.of("bad-id"))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("IDs must be positive integers.", exception.getReason());
    }

    @Test
    void archiveFood_shouldReturnNotFoundWhenRowMissing() {
        when(jdbcTemplate.update("UPDATE dbo.Foods SET IsActive = 0 WHERE FoodID = ?", 77)).thenReturn(0);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.archiveFood("Bearer admin", 77));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Food not found.", exception.getReason());
    }
}
