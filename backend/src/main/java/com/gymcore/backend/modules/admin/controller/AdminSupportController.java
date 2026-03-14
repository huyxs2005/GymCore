package com.gymcore.backend.modules.admin.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.admin.service.AdminSupportService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/support")
public class AdminSupportController {

    private final AdminSupportService adminSupportService;

    public AdminSupportController(AdminSupportService adminSupportService) {
        this.adminSupportService = adminSupportService;
    }

    @GetMapping("/customers")
    public ApiResponse<Map<String, Object>> searchCustomers(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestParam(required = false, name = "q") String query) {
        return ApiResponse.ok("Support customers retrieved", adminSupportService.searchCustomers(authorization, query));
    }

    @GetMapping("/customers/{customerId}")
    public ApiResponse<Map<String, Object>> getCustomerDetail(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable Integer customerId) {
        return ApiResponse.ok("Support customer detail retrieved",
                adminSupportService.getCustomerDetail(authorization, customerId));
    }
}
