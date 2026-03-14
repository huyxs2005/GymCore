package com.gymcore.backend.modules.content.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.GoalAdminService;
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
public class GoalAdminController {

    private final GoalAdminService goalAdminService;

    public GoalAdminController(GoalAdminService goalAdminService) {
        this.goalAdminService = goalAdminService;
    }

    @GetMapping("/admin/goals")
    public ApiResponse<Map<String, Object>> getGoals(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return ApiResponse.ok("Admin goals retrieved", goalAdminService.getGoals(authorization));
    }

    @PostMapping("/admin/goals")
    public ApiResponse<Map<String, Object>> createGoal(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin goal created", goalAdminService.createGoal(authorization, payload));
    }

    @PutMapping("/admin/goals/{goalId}")
    public ApiResponse<Map<String, Object>> updateGoal(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer goalId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin goal updated", goalAdminService.updateGoal(authorization, goalId, payload));
    }

    @DeleteMapping("/admin/goals/{goalId}")
    public ApiResponse<Map<String, Object>> archiveGoal(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer goalId) {
        return ApiResponse.ok("Admin goal archived", goalAdminService.archiveGoal(authorization, goalId));
    }

    @PatchMapping("/admin/goals/{goalId}/restore")
    public ApiResponse<Map<String, Object>> restoreGoal(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer goalId) {
        return ApiResponse.ok("Admin goal restored", goalAdminService.restoreGoal(authorization, goalId));
    }
}
