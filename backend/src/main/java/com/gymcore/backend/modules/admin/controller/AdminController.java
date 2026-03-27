package com.gymcore.backend.modules.admin.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.admin.service.AdminService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
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
    public ApiResponse<Map<String, Object>> getDashboardSummary(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        return ApiResponse.ok("Admin dashboard summary generated.",
                adminService.execute("get-dashboard-summary", authorizationHeader, null));
    }

    @GetMapping("/revenue/overview")
    public ApiResponse<Map<String, Object>> getRevenueOverview(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestParam(required = false) String preset,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String year) {


        Map<String, Object> filters = collectRevenueFilters(preset, from, to, month, year);
        return ApiResponse.ok("Revenue overview generated.",
                adminService.execute("get-revenue-overview", authorizationHeader, filters));
    }

    @GetMapping("/revenue/export.xlsx")
    public ResponseEntity<ByteArrayResource> exportRevenueExcel(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestParam(required = false) String preset,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String year) {
        AdminService.RevenueExport export = adminService.exportRevenueExcel(
                authorizationHeader, collectRevenueFilters(preset, from, to, month, year));
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(export.fileName()).build().toString())
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(export.content().length)
                .body(new ByteArrayResource(export.content()));
    }

    @GetMapping("/reports/revenue")
    public ApiResponse<Map<String, Object>> getRevenueReport(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("from", from);
        filters.put("to", to);
        return ApiResponse.ok("Revenue report endpoint ready for implementation",
                adminService.execute("get-revenue-report", authorizationHeader, filters));
    }

    @GetMapping("/reports/revenue/products")
    public ApiResponse<Map<String, Object>> getProductRevenue(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("from", from);
        filters.put("to", to);
        return ApiResponse.ok("Product revenue endpoint ready for implementation",
                adminService.execute("get-product-revenue", authorizationHeader, filters));
    }

    @GetMapping("/reports/revenue/memberships")
    public ApiResponse<Map<String, Object>> getMembershipRevenue(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("from", from);
        filters.put("to", to);
        return ApiResponse.ok("Membership revenue endpoint ready for implementation",
                adminService.execute("get-membership-revenue", authorizationHeader, filters));
    }

    @GetMapping("/coaches/students")
    public ApiResponse<Map<String, Object>> getCoachStudents(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        return ApiResponse.ok("Coach students endpoint ready for implementation",
                adminService.execute("get-coach-students", authorizationHeader, null));
    }

    @GetMapping("/coaches/feedback")
    public ApiResponse<Map<String, Object>> getCoachFeedback(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        return ApiResponse.ok("Coach feedback insights endpoint ready for implementation",
                adminService.execute("get-coach-feedback", authorizationHeader, null));
    }

    @PostMapping("/reports/export-pdf")
    public ApiResponse<Map<String, Object>> exportPdf(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Export PDF endpoint ready for implementation",
                adminService.execute("export-pdf", authorizationHeader, payload));
    }

    private void putIfPresent(Map<String, Object> filters, String key, String value) {
        if (value != null && !value.isBlank()) {
            filters.put(key, value);
        }
    }

    private Map<String, Object> collectRevenueFilters(String preset, String from, String to, String month, String year) {
        Map<String, Object> filters = new LinkedHashMap<>();
        putIfPresent(filters, "preset", preset);
        putIfPresent(filters, "from", from);
        putIfPresent(filters, "to", to);
        putIfPresent(filters, "month", month);
        putIfPresent(filters, "year", year);
        return filters;
    }
}
