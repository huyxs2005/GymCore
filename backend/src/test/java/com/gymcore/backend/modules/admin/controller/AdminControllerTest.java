package com.gymcore.backend.modules.admin.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.admin.service.AdminService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

class AdminControllerTest {

    private AdminService adminService;
    private AdminController controller;

    @BeforeEach
    void setUp() {
        adminService = Mockito.mock(AdminService.class);
        controller = new AdminController(adminService);
    }

    @Test
    void getDashboardSummary_shouldDelegateAuthorizationHeader() {
        when(adminService.execute("get-dashboard-summary", "Bearer admin", null))
                .thenReturn(Map.of("customerMetrics", Map.of("totalCustomers", 12)));

        ApiResponse<Map<String, Object>> response = controller.getDashboardSummary("Bearer admin");

        assertEquals(true, response.success());
        assertEquals(12, ((Map<?, ?>) response.data().get("customerMetrics")).get("totalCustomers"));
        verify(adminService).execute("get-dashboard-summary", "Bearer admin", null);
    }

    @Test
    void getRevenueOverview_shouldPassFiltersAndAuthorizationHeader() {
        when(adminService.execute(eq("get-revenue-overview"), eq("Bearer admin"), eq(Map.of(
                "preset", "7d",
                "from", "2026-03-01",
                "to", "2026-03-07"))))
                .thenReturn(Map.of("currency", "VND"));

        ApiResponse<Map<String, Object>> response = controller.getRevenueOverview(
                "Bearer admin", "7d", "2026-03-01", "2026-03-07", null, null);

        assertEquals("VND", response.data().get("currency"));
        verify(adminService).execute("get-revenue-overview", "Bearer admin", Map.of(
                "preset", "7d",
                "from", "2026-03-01",
                "to", "2026-03-07"));
    }

    @Test
    void getRevenueOverview_shouldIncludeMonthAndYearFiltersWhenProvided() {
        when(adminService.execute(eq("get-revenue-overview"), eq("Bearer admin"), eq(Map.of(
                "preset", "year",
                "month", "2026-03",
                "year", "2026"))))
                .thenReturn(Map.of("currency", "VND"));

        ApiResponse<Map<String, Object>> response = controller.getRevenueOverview(
                "Bearer admin", "year", null, null, "2026-03", "2026");

        assertEquals("VND", response.data().get("currency"));
        verify(adminService).execute("get-revenue-overview", "Bearer admin", Map.of(
                "preset", "year",
                "month", "2026-03",
                "year", "2026"));
    }

    @Test
    void exportRevenueExcel_shouldUseActiveFiltersAndReturnAttachment() {
        byte[] payload = new byte[] {1, 2, 3};
        when(adminService.exportRevenueExcel(eq("Bearer admin"), eq(Map.of(
                "preset", "month-detail",
                "month", "2026-03"))))
                .thenReturn(new AdminService.RevenueExport("GymCore_Revenue_2026-03.xlsx", payload));

        ResponseEntity<ByteArrayResource> response = controller.exportRevenueExcel(
                "Bearer admin", "month-detail", null, null, "2026-03", null);

        assertEquals("attachment; filename=\"GymCore_Revenue_2026-03.xlsx\"",
                response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertEquals(3L, response.getHeaders().getContentLength());
        assertEquals(3, response.getBody().getByteArray().length);
        verify(adminService).exportRevenueExcel("Bearer admin", Map.of(
                "preset", "month-detail",
                "month", "2026-03"));
    }
}
