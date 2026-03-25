package com.gymcore.backend.modules.content.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.ContentAdminService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ContentAdminControllerTest {

    private ContentAdminService contentAdminService;
    private ContentAdminController controller;

    @BeforeEach
    void setUp() {
        contentAdminService = Mockito.mock(ContentAdminService.class);
        controller = new ContentAdminController(contentAdminService);
    }

    @Test
    void getWorkouts_shouldDelegateToService() {
        when(contentAdminService.getWorkouts("Bearer admin")).thenReturn(Map.of("items", java.util.List.of()));

        ApiResponse<Map<String, Object>> response = controller.getWorkouts("Bearer admin");

        assertEquals(true, response.success());
        verify(contentAdminService).getWorkouts("Bearer admin");
    }

    @Test
    void createFood_shouldPassPayload() {
        Map<String, Object> payload = Map.of("name", "Greek Yogurt", "categoryIds", java.util.List.of(10));
        when(contentAdminService.createFood("Bearer admin", payload)).thenReturn(Map.of("foodId", 7));

        ApiResponse<Map<String, Object>> response = controller.createFood("Bearer admin", payload);

        assertEquals(7, response.data().get("foodId"));
        verify(contentAdminService).createFood("Bearer admin", payload);
    }

    @Test
    void restoreWorkout_shouldReturnServicePayload() {
        when(contentAdminService.restoreWorkout("Bearer admin", 11)).thenReturn(Map.of("workoutId", 11, "active", true));

        ApiResponse<Map<String, Object>> response = controller.restoreWorkout("Bearer admin", 11);

        assertEquals(true, response.data().get("active"));
        verify(contentAdminService).restoreWorkout("Bearer admin", 11);
    }
}
