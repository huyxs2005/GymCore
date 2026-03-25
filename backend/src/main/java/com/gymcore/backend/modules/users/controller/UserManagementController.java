package com.gymcore.backend.modules.users.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.users.service.UserManagementService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class UserManagementController {

    private final UserManagementService userManagementService;

    public UserManagementController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @GetMapping("/reception/customers/search")
    public ApiResponse<Map<String, Object>> searchCustomers(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestParam("q") String query
    ) {
        Map<String, Object> request = new java.util.LinkedHashMap<>();
        request.put("authorizationHeader", authorizationHeader);
        request.put("query", query);
        return ApiResponse.ok("Reception customer search endpoint ready for implementation",
                userManagementService.execute("reception-search-customers", request));
    }

    @GetMapping("/reception/customers/{customerId}/membership")
    public ApiResponse<Map<String, Object>> getCustomerMembership(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer customerId
    ) {
        Map<String, Object> request = new java.util.LinkedHashMap<>();
        request.put("authorizationHeader", authorizationHeader);
        request.put("customerId", customerId);
        return ApiResponse.ok("Reception customer membership endpoint ready for implementation",
                userManagementService.execute("reception-customer-membership", request));
    }

    @GetMapping("/admin/users")
    public ApiResponse<Map<String, Object>> getUsers(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "locked", required = false) String locked,
            @RequestParam(value = "active", required = false) String active) {
        Map<String, Object> request = new java.util.LinkedHashMap<>();
        request.put("authorizationHeader", authorizationHeader);
        request.put("query", query);
        request.put("role", role);
        request.put("locked", locked);
        request.put("active", active);
        return ApiResponse.ok("Admin users endpoint ready for implementation",
                userManagementService.execute("admin-get-users", request));
    }

    @PostMapping("/admin/users/staff")
    public ApiResponse<Map<String, Object>> createStaff(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", authorizationHeader);
        return ApiResponse.ok("Create staff endpoint ready for implementation",
                userManagementService.execute("admin-create-staff", request));
    }

    @PutMapping("/admin/users/{userId}")
    public ApiResponse<Map<String, Object>> updateStaff(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable Integer userId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Update staff endpoint ready for implementation",
                userManagementService.execute("admin-update-staff",
                        Map.of("authorizationHeader", authorizationHeader, "userId", userId, "body", payload)));
    }

    @PatchMapping("/admin/users/{userId}/lock")
    public ApiResponse<Map<String, Object>> lockUser(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable Integer userId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Lock user endpoint ready for implementation",
                userManagementService.execute("admin-lock-user",
                        Map.of("authorizationHeader", authorizationHeader, "userId", userId, "body", payload)));
    }

    @PatchMapping("/admin/users/{userId}/unlock")
    public ApiResponse<Map<String, Object>> unlockUser(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable Integer userId) {
        return ApiResponse.ok("Unlock user endpoint ready for implementation",
                userManagementService.execute("admin-unlock-user",
                        Map.of("authorizationHeader", authorizationHeader, "userId", userId)));
    }
}
