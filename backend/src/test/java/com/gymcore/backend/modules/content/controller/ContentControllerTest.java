package com.gymcore.backend.modules.content.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.ContentService;
import com.gymcore.backend.modules.content.service.GeminiChatService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ContentControllerTest {

    private ContentService contentService;
    private GeminiChatService geminiChatService;
    private ContentController controller;

    @BeforeEach
    void setUp() {
        contentService = Mockito.mock(ContentService.class);
        geminiChatService = Mockito.mock(GeminiChatService.class);
        controller = new ContentController(contentService, geminiChatService);
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
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", null);
        when(contentService.execute("ai-workout-assistant", request))
                .thenReturn(Map.of("answer", "Do push-ups"));

        ApiResponse<Map<String, Object>> response = controller.askWorkoutAssistant(null, payload);

        assertEquals("Do push-ups", response.data().get("answer"));
        verify(contentService).execute("ai-workout-assistant", request);
    }

    @Test
    void askFoodAssistant_shouldPassPayload() {
        Map<String, Object> payload = Map.of("question", "Suggest meals");
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", null);
        when(contentService.execute("ai-food-assistant", request))
                .thenReturn(Map.of("answer", "Try oatmeal"));

        ApiResponse<Map<String, Object>> response = controller.askFoodAssistant(null, payload);

        assertEquals("Try oatmeal", response.data().get("answer"));
        verify(contentService).execute("ai-food-assistant", request);
    }

    @Test
    void askCoachBookingAssistant_shouldPassPayload() {
        Map<String, Object> payload = Map.of("question", "Find a PT slot");
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", null);
        when(contentService.execute("ai-coach-booking-assistant", request))
                .thenReturn(Map.of("answer", "Try Monday"));

        ApiResponse<Map<String, Object>> response = controller.askCoachBookingAssistant(null, payload);

        assertEquals("Try Monday", response.data().get("answer"));
        verify(contentService).execute("ai-coach-booking-assistant", request);
    }

    @Test
    void getAiRecommendations_shouldPassPayload() {
        Map<String, Object> payload = Map.of("goal", "lose fat");
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", null);
        when(contentService.execute("ai-recommendations", request))
                .thenReturn(Map.of("recommendations", java.util.List.of("Burpee")));

        ApiResponse<Map<String, Object>> response = controller.getAiRecommendations(null, payload);

        assertEquals(true, response.success());
        verify(contentService).execute("ai-recommendations", request);
    }

    @Test
    void getAiWeeklyPlan_shouldPassPayload() {
        Map<String, Object> payload = Map.of("goal", "gain muscle");
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", "Bearer customer");
        when(contentService.execute("ai-weekly-plan", request))
                .thenReturn(Map.of("contractVersion", "ai-weekly-plan.v1"));

        ApiResponse<Map<String, Object>> response = controller.getAiWeeklyPlan("Bearer customer", payload);

        assertEquals("ai-weekly-plan.v1", response.data().get("contractVersion"));
        verify(contentService).execute("ai-weekly-plan", request);
    }

    @Test
    void getPersonalizedFoodRecommendations_shouldPassAuthorizationHeader() {
        Map<String, Object> payload = Map.of("tags", java.util.List.of("HIGH_PROTEIN"));
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", "Bearer token");
        when(contentService.execute("ai-food-personalized", request))
                .thenReturn(Map.of("foods", java.util.List.of(Map.of("foodId", 4))));

        ApiResponse<Map<String, Object>> response = controller.getPersonalizedFoodRecommendations("Bearer token", payload);

        assertEquals(true, response.success());
        verify(contentService).execute("ai-food-personalized", request);
    }

    @Test
    @SuppressWarnings("unchecked")
    void chat_shouldAttachResolvedAiContextMetadata() {
        Map<String, Object> payload = Map.of(
                "messages", java.util.List.of(Map.of("role", "user", "content", "What should I do this week?")),
                "context", Map.of("mode", "knowledge"));
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", "Bearer customer");
        Map<String, Object> aiContextEnvelope = Map.of(
                "aiContext", Map.of("contractVersion", "ai-context.v1"),
                "contextMeta", Map.of("usedSignals", java.util.List.of("goals", "health", "progress")));
        when(contentService.execute("resolve-ai-context", request)).thenReturn(aiContextEnvelope);
        when(geminiChatService.chat(
                org.mockito.ArgumentMatchers.anyList(),
                org.mockito.ArgumentMatchers.argThat(context ->
                        "ai-context.v1".equals(((Map<?, ?>) context.get("aiContext")).get("contractVersion"))
                                && ((Map<?, ?>) context.get("contextMeta")).get("usedSignals")
                                        .equals(java.util.List.of("goals", "health", "progress"))
                                && "ai-chat".equals(((Map<?, ?>) context.get("contextMeta")).get("entryPoint")))))
                .thenReturn("Keep two strength sessions and one recovery session.");

        ApiResponse<Map<String, Object>> response = controller.chat("Bearer customer", payload);

        assertEquals("Keep two strength sessions and one recovery session.", response.data().get("reply"));
        assertEquals(
                java.util.List.of("goals", "health", "progress"),
                ((Map<String, Object>) response.data().get("contextMeta")).get("usedSignals"));
        assertEquals("ai-chat", ((Map<String, Object>) response.data().get("contextMeta")).get("entryPoint"));
        assertEquals("chat", ((Map<String, Object>) response.data().get("contextMeta")).get("responseType"));
        verify(contentService).execute("resolve-ai-context", request);
    }
}
