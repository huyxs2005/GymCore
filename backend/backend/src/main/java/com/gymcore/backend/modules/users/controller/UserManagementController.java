package com.gymcore.backend.modules.users.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.users.service.UserManagementService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    public ApiResponse<Map<String, Object>> searchCustomers(@RequestParam("q") String query) {
        return ApiResponse.ok("Reception customer search endpoint ready for implementation",
                userManagementService.execute("reception-search-customers", Map.of("query", query)));
    }

    @GetMapping("/reception/customers/{customerId}/membership")
    public ApiResponse<Map<String, Object>> getCustomerMembership(@PathVariable Integer customerId) {
        return ApiResponse.ok("Reception customer membership endpoint ready for implementation",
                userManagementService.execute("reception-customer-membership", Map.of("customerId", customerId)));
    }

    @GetMapping("/admin/users")
    public ApiResponse<Map<String, Object>> getUsers() {
        return ApiResponse.ok("Admin users endpoint ready for implementation",
                userManagementService.execute("admin-get-users", null));
    }

    @PostMapping("/admin/users/staff")
    public ApiResponse<Map<String, Object>> createStaff(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Create staff endpoint ready for implementation",
                userManagementService.execute("admin-create-staff", payload));
    }

    @PatchMapping("/admin/users/{userId}/lock")
    public ApiResponse<Map<String, Object>> lockUser(@PathVariable Integer userId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Lock user endpoint ready for implementation",
                userManagementService.execute("admin-lock-user", Map.of("userId", userId, "body", payload)));
    }

    @PatchMapping("/admin/users/{userId}/unlock")
    public ApiResponse<Map<String, Object>> unlockUser(@PathVariable Integer userId) {
        return ApiResponse.ok("Unlock user endpoint ready for implementation",
                userManagementService.execute("admin-unlock-user", Map.of("userId", userId)));
    }
}
