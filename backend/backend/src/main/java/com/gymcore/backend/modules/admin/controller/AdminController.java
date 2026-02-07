package com.gymcore.backend.modules.admin.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.admin.service.AdminService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/dashboard-summary")
    public ApiResponse<Map<String, Object>> getDashboardSummary() {
        return ApiResponse.ok("Admin dashboard summary endpoint ready for implementation",
                adminService.execute("get-dashboard-summary", null));
    }

    @GetMapping("/revenue/overview")
    public ApiResponse<Map<String, Object>> getRevenueOverview() {
        return ApiResponse.ok("Revenue overview endpoint ready for implementation",
                adminService.execute("get-revenue-overview", null));
    }

    @GetMapping("/reports/revenue")
    public ApiResponse<Map<String, Object>> getRevenueReport(@RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("from", from);
        filters.put("to", to);
        return ApiResponse.ok("Revenue report endpoint ready for implementation",
                adminService.execute("get-revenue-report", filters));
    }

    @GetMapping("/reports/revenue/products")
    public ApiResponse<Map<String, Object>> getProductRevenue(@RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("from", from);
        filters.put("to", to);
        return ApiResponse.ok("Product revenue endpoint ready for implementation",
                adminService.execute("get-product-revenue", filters));
    }

    @GetMapping("/reports/revenue/memberships")
    public ApiResponse<Map<String, Object>> getMembershipRevenue(@RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("from", from);
        filters.put("to", to);
        return ApiResponse.ok("Membership revenue endpoint ready for implementation",
                adminService.execute("get-membership-revenue", filters));
    }

    @GetMapping("/coaches/students")
    public ApiResponse<Map<String, Object>> getCoachStudents() {
        return ApiResponse.ok("Coach students endpoint ready for implementation",
                adminService.execute("get-coach-students", null));
    }

    @GetMapping("/coaches/feedback")
    public ApiResponse<Map<String, Object>> getCoachFeedback() {
        return ApiResponse.ok("Coach feedback insights endpoint ready for implementation",
                adminService.execute("get-coach-feedback", null));
    }

    @PostMapping("/reports/export-pdf")
    public ApiResponse<Map<String, Object>> exportPdf(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Export PDF endpoint ready for implementation", adminService.execute("export-pdf", payload));
    }
}
