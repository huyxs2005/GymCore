package com.gymcore.backend.modules.content.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.ContentService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ContentController {

    private final ContentService contentService;

    public ContentController(ContentService contentService) {
        this.contentService = contentService;
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

    @GetMapping("/meals/categories")
    public ApiResponse<Map<String, Object>> getMealCategories() {
        return ApiResponse.ok("Meal categories endpoint ready for implementation",
                contentService.execute("get-meal-categories", null));
    }

    @GetMapping("/meals")
    public ApiResponse<Map<String, Object>> getMeals() {
        return ApiResponse.ok("Meals endpoint ready for implementation", contentService.execute("get-meals", null));
    }

    @GetMapping("/meals/{mealId}")
    public ApiResponse<Map<String, Object>> getMealDetail(@PathVariable Integer mealId) {
        return ApiResponse.ok("Meal detail endpoint ready for implementation",
                contentService.execute("get-meal-detail", Map.of("mealId", mealId)));
    }

    @GetMapping("/goals")
    public ApiResponse<Map<String, Object>> getFitnessGoals() {
        return ApiResponse.ok("Fitness goals endpoint ready for implementation",
                contentService.execute("get-fitness-goals", null));
    }

    @GetMapping("/allergens")
    public ApiResponse<Map<String, Object>> getAllergens() {
        return ApiResponse.ok("Allergens endpoint ready for implementation",
                contentService.execute("get-allergens", null));
    }

    @PostMapping("/ai/workout-assistant")
    public ApiResponse<Map<String, Object>> askWorkoutAssistant(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Workout assistant endpoint ready for implementation",
                contentService.execute("ai-workout-assistant", payload));
    }

    @PostMapping("/ai/coach-booking-assistant")
    public ApiResponse<Map<String, Object>> askCoachBookingAssistant(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach booking assistant endpoint ready for implementation",
                contentService.execute("ai-coach-booking-assistant", payload));
    }

    @PostMapping("/ai/recommendations")
    public ApiResponse<Map<String, Object>> getAiRecommendations(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("AI recommendations endpoint ready for implementation",
                contentService.execute("ai-recommendations", payload));
    }
}
