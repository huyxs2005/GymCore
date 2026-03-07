package com.gymcore.backend.modules.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class ReportServiceTest {

    private JdbcTemplate jdbcTemplate;
    private ReportService reportService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        reportService = new ReportService(jdbcTemplate);
    }

    @Test
    void getRevenueReport_shouldReturnProductAndMembershipData() {
        when(jdbcTemplate.queryForList(contains("vw_Revenue_ProductOrders")))
                .thenReturn(List.of(Map.of("RevenueDate", "2026-03-07", "RevenueAmount", BigDecimal.valueOf(2700), "PaidOrders", 2)));
        when(jdbcTemplate.queryForList(contains("vw_Revenue_Memberships")))
                .thenReturn(List.of(Map.of("RevenueDate", "2026-03-07", "RevenueAmount", BigDecimal.valueOf(6000), "PaidMemberships", 1)));

        Map<String, Object> report = reportService.getRevenueReport();

        assertEquals(1, ((List<?>) report.get("productOrders")).size());
        assertEquals(1, ((List<?>) report.get("memberships")).size());
        assertTrue(report.containsKey("generatedAt"));
    }

    @Test
    void exportRevenueToPdf_shouldReturnPdfBytes() {
        when(jdbcTemplate.queryForList(contains("vw_Revenue_ProductOrders")))
                .thenReturn(List.of(Map.of("RevenueDate", "2026-03-07", "RevenueAmount", BigDecimal.valueOf(2700), "PaidOrders", 2)));
        when(jdbcTemplate.queryForList(contains("vw_Revenue_Memberships")))
                .thenReturn(List.of(Map.of("RevenueDate", "2026-03-07", "RevenueAmount", BigDecimal.valueOf(6000), "PaidMemberships", 1)));

        byte[] bytes = reportService.exportRevenueToPdf();

        assertTrue(bytes.length > 0);
        String header = new String(bytes, 0, Math.min(bytes.length, 4));
        assertEquals("%PDF", header);
    }

    @Test
    void exportRevenueToPdf_shouldWrapGenerationFailure() {
        when(jdbcTemplate.queryForList(contains("vw_Revenue_ProductOrders")))
                .thenThrow(new RuntimeException("View missing"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, reportService::exportRevenueToPdf);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, exception.getStatusCode());
        assertEquals("Failed to export revenue report PDF.", exception.getReason());
    }
}
