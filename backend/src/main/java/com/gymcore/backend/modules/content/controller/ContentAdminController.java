package com.gymcore.backend.modules.content.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.ContentAdminService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ContentAdminController {

    private final ContentAdminService contentAdminService;

    public ContentAdminController(ContentAdminService contentAdminService) {
        this.contentAdminService = contentAdminService;
    }

    @GetMapping("/admin/workouts")
    public ApiResponse<Map<String, Object>> getWorkouts(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return ApiResponse.ok("Admin workouts retrieved", contentAdminService.getWorkouts(authorization));
    }

    @PostMapping("/admin/workouts")
    public ApiResponse<Map<String, Object>> createWorkout(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin workout created", contentAdminService.createWorkout(authorization, payload));
    }

    @PutMapping("/admin/workouts/{workoutId}")
    public ApiResponse<Map<String, Object>> updateWorkout(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer workoutId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin workout updated",
                contentAdminService.updateWorkout(authorization, workoutId, payload));
    }

    @DeleteMapping("/admin/workouts/{workoutId}")
    public ApiResponse<Map<String, Object>> archiveWorkout(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer workoutId) {
        return ApiResponse.ok("Admin workout archived",
                contentAdminService.archiveWorkout(authorization, workoutId));
    }

    @PatchMapping("/admin/workouts/{workoutId}/restore")
    public ApiResponse<Map<String, Object>> restoreWorkout(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer workoutId) {
        return ApiResponse.ok("Admin workout restored",
                contentAdminService.restoreWorkout(authorization, workoutId));
    }

    @GetMapping("/admin/foods")
    public ApiResponse<Map<String, Object>> getFoods(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return ApiResponse.ok("Admin foods retrieved", contentAdminService.getFoods(authorization));
    }

    @PostMapping("/admin/foods")
    public ApiResponse<Map<String, Object>> createFood(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin food created", contentAdminService.createFood(authorization, payload));
    }

    @PutMapping("/admin/foods/{foodId}")
    public ApiResponse<Map<String, Object>> updateFood(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer foodId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin food updated",
                contentAdminService.updateFood(authorization, foodId, payload));
    }

    @DeleteMapping("/admin/foods/{foodId}")
    public ApiResponse<Map<String, Object>> archiveFood(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer foodId) {
        return ApiResponse.ok("Admin food archived",
                contentAdminService.archiveFood(authorization, foodId));
    }

    @PatchMapping("/admin/foods/{foodId}/restore")
    public ApiResponse<Map<String, Object>> restoreFood(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer foodId) {
        return ApiResponse.ok("Admin food restored",
                contentAdminService.restoreFood(authorization, foodId));
    }
}

