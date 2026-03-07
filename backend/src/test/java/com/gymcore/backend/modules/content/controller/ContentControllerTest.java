package com.gymcore.backend.modules.content.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.ContentService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ContentControllerTest {

    private ContentService contentService;
    private ContentController controller;

    @BeforeEach
    void setUp() {
        contentService = Mockito.mock(ContentService.class);
        controller = new ContentController(contentService);
    }

    @Test
    void getWorkoutCategories_shouldDelegateToService() {
        when(contentService.execute("get-workout-categories", null))
                .thenReturn(Map.of("items", java.util.List.of("Strength")));

        ApiResponse<Map<String, Object>> response = controller.getWorkoutCategories();

        assertEquals(true, response.success());
        assertEquals(java.util.List.of("Strength"), response.data().get("items"));
        verify(contentService).execute("get-workout-categories", null);
    }

    @Test
    void getWorkouts_shouldDelegateToService() {
        when(contentService.execute("get-workouts", null))
                .thenReturn(Map.of("items", java.util.List.of(Map.of("workoutId", 1))));

        ApiResponse<Map<String, Object>> response = controller.getWorkouts();

        assertEquals(true, response.success());
        verify(contentService).execute("get-workouts", null);
    }

    @Test
    void getWorkoutDetail_shouldPassWorkoutId() {
        when(contentService.execute("get-workout-detail", Map.of("workoutId", 7)))
                .thenReturn(Map.of("workoutId", 7));

        ApiResponse<Map<String, Object>> response = controller.getWorkoutDetail(7);

        assertEquals(7, response.data().get("workoutId"));
        verify(contentService).execute("get-workout-detail", Map.of("workoutId", 7));
    }

    @Test
    void getFoodCategories_shouldDelegateToService() {
        when(contentService.execute("get-food-categories", null))
                .thenReturn(Map.of("items", java.util.List.of("Protein")));

        ApiResponse<Map<String, Object>> response = controller.getFoodCategories();

        assertEquals(true, response.success());
        verify(contentService).execute("get-food-categories", null);
    }

    @Test
    void getFoods_shouldDelegateToService() {
        when(contentService.execute("get-foods", null))
                .thenReturn(Map.of("items", java.util.List.of(Map.of("foodId", 2))));

        ApiResponse<Map<String, Object>> response = controller.getFoods();

        assertEquals(true, response.success());
        verify(contentService).execute("get-foods", null);
    }

    @Test
    void getFoodDetail_shouldPassFoodId() {
        when(contentService.execute("get-food-detail", Map.of("foodId", 9)))
                .thenReturn(Map.of("foodId", 9));

        ApiResponse<Map<String, Object>> response = controller.getFoodDetail(9);

        assertEquals(9, response.data().get("foodId"));
        verify(contentService).execute("get-food-detail", Map.of("foodId", 9));
    }

    @Test
    void getFitnessGoals_shouldDelegateToService() {
        when(contentService.execute("get-fitness-goals", null))
                .thenReturn(Map.of("items", java.util.List.of("GAIN_MUSCLE")));

        ApiResponse<Map<String, Object>> response = controller.getFitnessGoals();

        assertEquals(true, response.success());
        verify(contentService).execute("get-fitness-goals", null);
    }

    @Test
    void askWorkoutAssistant_shouldPassPayload() {
        Map<String, Object> payload = Map.of("question", "Plan a push workout");
        when(contentService.execute("ai-workout-assistant", payload))
                .thenReturn(Map.of("answer", "Do push-ups"));

        ApiResponse<Map<String, Object>> response = controller.askWorkoutAssistant(payload);

        assertEquals("Do push-ups", response.data().get("answer"));
        verify(contentService).execute("ai-workout-assistant", payload);
    }

    @Test
    void askCoachBookingAssistant_shouldPassPayload() {
        Map<String, Object> payload = Map.of("question", "Find a PT slot");
        when(contentService.execute("ai-coach-booking-assistant", payload))
                .thenReturn(Map.of("answer", "Try Monday"));

        ApiResponse<Map<String, Object>> response = controller.askCoachBookingAssistant(payload);

        assertEquals("Try Monday", response.data().get("answer"));
        verify(contentService).execute("ai-coach-booking-assistant", payload);
    }

    @Test
    void getAiRecommendations_shouldPassPayload() {
        Map<String, Object> payload = Map.of("goal", "lose fat");
        when(contentService.execute("ai-recommendations", payload))
                .thenReturn(Map.of("recommendations", java.util.List.of("Burpee")));

        ApiResponse<Map<String, Object>> response = controller.getAiRecommendations(payload);

        assertEquals(true, response.success());
        verify(contentService).execute("ai-recommendations", payload);
    }
}
