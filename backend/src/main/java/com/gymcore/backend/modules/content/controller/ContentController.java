package com.gymcore.backend.modules.content.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.ContentService;
import com.gymcore.backend.modules.content.service.GeminiChatService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ContentController {

    private final ContentService contentService;
    private final GeminiChatService geminiChatService;

    public ContentController(ContentService contentService, GeminiChatService geminiChatService) {
        this.contentService = contentService;
        this.geminiChatService = geminiChatService;
    }

    @GetMapping("/workouts/categories")
    public ApiResponse<Map<String, Object>> getWorkoutCategories() {
        return ApiResponse.ok("Workout categories endpoint ready for implementation",
                contentService.execute("get-workout-categories", null));
    }

    @GetMapping("/workouts")
    public ApiResponse<Map<String, Object>> getWorkouts() {
        return ApiResponse.ok("Workouts endpoint ready for implementation", contentService.execute("get-workouts", null));
    }

    @GetMapping("/workouts/{workoutId}")
    public ApiResponse<Map<String, Object>> getWorkoutDetail(@PathVariable Integer workoutId) {
        return ApiResponse.ok("Workout detail endpoint ready for implementation",
                contentService.execute("get-workout-detail", Map.of("workoutId", workoutId)));
    }

    @GetMapping("/foods/categories")
    public ApiResponse<Map<String, Object>> getFoodCategories() {
        return ApiResponse.ok("Food categories endpoint ready for implementation",
                contentService.execute("get-food-categories", null));
    }

    @GetMapping("/foods")
    public ApiResponse<Map<String, Object>> getFoods() {
        return ApiResponse.ok("Foods endpoint ready for implementation", contentService.execute("get-foods", null));
    }

    @GetMapping("/foods/{foodId}")
    public ApiResponse<Map<String, Object>> getFoodDetail(@PathVariable Integer foodId) {
        return ApiResponse.ok("Food detail endpoint ready for implementation",
                contentService.execute("get-food-detail", Map.of("foodId", foodId)));
    }

    @GetMapping("/goals")
    public ApiResponse<Map<String, Object>> getFitnessGoals() {
        return ApiResponse.ok("Fitness goals endpoint ready for implementation",
                contentService.execute("get-fitness-goals", null));
    }

    @GetMapping("/customer/goals")
    public ApiResponse<Map<String, Object>> getCustomerGoals(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        return ApiResponse.ok("Customer fitness goals retrieved",
                contentService.execute("get-customer-goals", Map.of("authorizationHeader", authorizationHeader)));
    }

    @PutMapping("/customer/goals")
    public ApiResponse<Map<String, Object>> updateCustomerGoals(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Customer fitness goals updated",
                contentService.execute("update-customer-goals", withAuthorization(authorizationHeader, payload)));
    }

    @PostMapping("/ai/workout-assistant")
    public ApiResponse<Map<String, Object>> askWorkoutAssistant(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Workout assistant endpoint ready for implementation",
                contentService.execute("ai-workout-assistant", withAuthorization(authorizationHeader, payload)));
    }

    @PostMapping("/ai/coach-booking-assistant")
    public ApiResponse<Map<String, Object>> askCoachBookingAssistant(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach booking assistant endpoint ready for implementation",
                contentService.execute("ai-coach-booking-assistant", withAuthorization(authorizationHeader, payload)));
    }

    @PostMapping("/ai/recommendations")
    public ApiResponse<Map<String, Object>> getAiRecommendations(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("AI recommendations endpoint ready for implementation",
                contentService.execute("ai-recommendations", withAuthorization(authorizationHeader, payload)));
    }

    @PostMapping("/ai/weekly-plan")
    public ApiResponse<Map<String, Object>> getAiWeeklyPlan(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("AI weekly plan generated",
                contentService.execute("ai-weekly-plan", withAuthorization(authorizationHeader, payload)));
    }

    @PostMapping("/ai/food-personalized")
    public ApiResponse<Map<String, Object>> getPersonalizedFoodRecommendations(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Personalized food recommendations generated",
                contentService.execute("ai-food-personalized", withAuthorization(authorizationHeader, payload)));
    }

    @PostMapping("/ai/chat")
    public ApiResponse<Map<String, Object>> chat(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        Object rawMessages = payload == null ? null : payload.get("messages");
        Object rawContext = payload == null ? null : payload.get("context");
        @SuppressWarnings("unchecked")
        java.util.List<java.util.Map<String, Object>> messages = rawMessages instanceof java.util.List<?> list
                ? (java.util.List<java.util.Map<String, Object>>) list
                : java.util.List.of();
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> context = rawContext instanceof java.util.Map<?, ?> map
                ? (java.util.Map<String, Object>) map
                : new java.util.LinkedHashMap<>();
        Map<String, Object> request = withAuthorization(authorizationHeader, payload);
        @SuppressWarnings("unchecked")
        Map<String, Object> aiContextEnvelope = (Map<String, Object>) contentService.execute("resolve-ai-context", request);
        context = new java.util.LinkedHashMap<>(context);
        context.put("conversationMessages", messages);
        context.put("aiContext", aiContextEnvelope.getOrDefault("aiContext", Map.of()));
        Map<String, Object> responseContextMeta = new java.util.LinkedHashMap<>(
                (Map<String, Object>) aiContextEnvelope.getOrDefault("contextMeta", Map.of()));
        responseContextMeta.put("entryPoint", "ai-chat");
        responseContextMeta.put("responseType", "chat");
        context.put("contextMeta", responseContextMeta);
        String reply = geminiChatService.chat(messages, context);
        return ApiResponse.ok("AI chat response generated", java.util.Map.of(
                "reply", reply,
                "contextMeta", responseContextMeta));
    }

    private Map<String, Object> withAuthorization(String authorizationHeader, Map<String, Object> payload) {
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload == null ? Map.of() : payload);
        request.put("authorizationHeader", authorizationHeader);
        return request;
    }
}
