package com.gymcore.backend.modules.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.Year;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class AdminServiceDashboardTest {

    private CurrentUserService currentUserService;
    private AdminService adminService;

    @BeforeEach
    void setUp() {
        currentUserService = Mockito.mock(CurrentUserService.class);
        adminService = new AdminService(new FakeDashboardJdbcTemplate(), currentUserService);
        when(currentUserService.requireAdmin("Bearer admin"))
                .thenReturn(new CurrentUserService.UserInfo(1, "Admin", "ADMIN"));
    }

    @Test
    void getDashboardSummary_shouldAssembleMetricsAndAlerts() {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) adminService.execute("get-dashboard-summary", "Bearer admin", null);

        @SuppressWarnings("unchecked")
        Map<String, Object> customerMetrics = (Map<String, Object>) result.get("customerMetrics");
        @SuppressWarnings("unchecked")
        Map<String, Object> commerceMetrics = (Map<String, Object>) result.get("commerceMetrics");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> alerts = (List<Map<String, Object>>) result.get("alerts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> recentPayments = (List<Map<String, Object>>) result.get("recentPayments");

        assertEquals(12, customerMetrics.get("totalCustomers"));
        assertEquals(3, commerceMetrics.get("awaitingPickupOrders"));
        assertEquals(1, recentPayments.size());
        assertFalse(alerts.isEmpty());
        assertTrue(alerts.stream().anyMatch(alert -> "pickup-queue".equals(alert.get("key"))));
    }

    @Test
    void getRevenueOverview_shouldReturnTilesSplitAndGapFilledSeries() {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) adminService.execute(
                "get-revenue-overview", "Bearer admin", Map.of("from", "2026-03-01", "to", "2026-03-07", "preset", "7d"));

        @SuppressWarnings("unchecked")
        Map<String, Object> range = (Map<String, Object>) result.get("range");
        @SuppressWarnings("unchecked")
        Map<String, Object> tiles = (Map<String, Object>) result.get("tiles");
        @SuppressWarnings("unchecked")
        Map<String, Object> split = (Map<String, Object>) result.get("split");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> series = (List<Map<String, Object>>) result.get("series");

        assertEquals("7d", range.get("preset"));
        assertEquals(new BigDecimal("1200.00"), tiles.get("todayRevenue"));
        assertEquals(new BigDecimal("15000.00"), tiles.get("monthToDateRevenue"));
        assertEquals(new BigDecimal("2500.00"), split.get("products"));
        assertEquals(new BigDecimal("4500.00"), split.get("memberships"));
        assertEquals(7, series.size());
    }

    @Test
    void getRevenueOverview_shouldRejectUnsupportedPreset() {
        ResponseStatusException exception = org.junit.jupiter.api.Assertions.assertThrows(
                ResponseStatusException.class,
                () -> adminService.execute("get-revenue-overview", "Bearer admin", Map.of("preset", "quarter")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Unsupported revenue preset.", exception.getReason());
    }

    @Test
    void getRevenueOverview_shouldSupportSpecificMonthPreset() {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) adminService.execute(
                "get-revenue-overview", "Bearer admin", Map.of("preset", "month-detail", "month", "2026-03"));

        @SuppressWarnings("unchecked")
        Map<String, Object> range = (Map<String, Object>) result.get("range");

        assertEquals("month-detail", range.get("preset"));
        assertEquals(YearMonth.of(2026, 3).atDay(1).toString(), range.get("from"));
        assertEquals(YearMonth.of(2026, 3).atEndOfMonth().toString(), range.get("to"));
    }

    @Test
    void getRevenueOverview_shouldSupportSpecificYearPreset() {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) adminService.execute(
                "get-revenue-overview", "Bearer admin", Map.of("preset", "year", "year", "2025"));

        @SuppressWarnings("unchecked")
        Map<String, Object> range = (Map<String, Object>) result.get("range");

        assertEquals("year", range.get("preset"));
        assertEquals(Year.of(2025).atDay(1).toString(), range.get("from"));
        assertEquals(Year.of(2025).atMonth(12).atEndOfMonth().toString(), range.get("to"));
    }

    @Test
    void getDashboardSummary_shouldGracefullyDisablePickupMetricsWhenPickupColumnsAreMissing() {
        AdminService fallbackService = new AdminService(new MissingPickupDashboardJdbcTemplate(), currentUserService);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) fallbackService.execute("get-dashboard-summary", "Bearer admin", null);
        @SuppressWarnings("unchecked")
        Map<String, Object> commerceMetrics = (Map<String, Object>) result.get("commerceMetrics");

        assertEquals(0, commerceMetrics.get("awaitingPickupOrders"));
        assertEquals(0, commerceMetrics.get("pickedUpToday"));
        assertEquals(Boolean.FALSE, commerceMetrics.get("pickupTrackingAvailable"));
        assertEquals(List.of(), result.get("awaitingPickupOrders"));
    }

    @Test
    void exportRevenueExcel_shouldGenerateWorkbookForAppliedRange() throws Exception {
        AdminService.RevenueExport export = adminService.exportRevenueExcel(
                "Bearer admin", Map.of("preset", "month-detail", "month", "2026-03"));

        assertEquals("GymCore_Revenue_2026-03.xlsx", export.fileName());

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(export.content()))) {
            assertEquals("Summary", workbook.getSheetAt(0).getSheetName());
            assertEquals("Daily Revenue", workbook.getSheetAt(1).getSheetName());
            assertEquals("GymCore", workbook.getSheetAt(0).getRow(0).getCell(1).getStringCellValue());
            assertEquals("2026-03-01", workbook.getSheetAt(1).getRow(1).getCell(0).getStringCellValue());
        }
    }

    private static class FakeDashboardJdbcTemplate extends JdbcTemplate {

        private int moneyQueryIndex = 0;

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            return resolveScalar(sql, requiredType);
        }

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType) {
            return resolveScalar(sql, requiredType);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            return resolveList(sql);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper) {
            return resolveList(sql);
        }

        @SuppressWarnings("unchecked")
        private <T> T resolveScalar(String sql, Class<T> requiredType) {
            if (Integer.class.equals(requiredType)) {
                Integer value;
                if (sql.contains("INFORMATION_SCHEMA.TABLES")) value = 1;
                else if (sql.contains("INFORMATION_SCHEMA.COLUMNS")) value = 1;
                else if (sql.contains("dbo.Customers")) value = 12;
                else if (sql.contains("COUNT(DISTINCT cm.CustomerID)")) value = 8;
                else if (sql.contains("CustomerMemberships") && sql.contains("Status = 'ACTIVE'") && !sql.contains("EndDate >= ?")) value = 9;
                else if (sql.contains("CustomerMemberships") && sql.contains("Status = 'SCHEDULED'")) value = 2;
                else if (sql.contains("CustomerMemberships") && sql.contains("EndDate >= ?") && sql.contains("EndDate <= ?")) value = 3;
                else if (sql.contains("RoleName = 'Coach'")) value = 4;
                else if (sql.contains("RoleName = 'Receptionist'")) value = 2;
                else if (sql.contains("RoleName = 'Admin'")) value = 1;
                else if (sql.contains("RoleName IN ('Admin', 'Coach', 'Receptionist')") && sql.contains("u.IsLocked = 1")) value = 1;
                else if (sql.contains("PTRecurringRequests") && sql.contains("Status = 'PENDING'")) value = 2;
                else if (sql.contains("PTRecurringRequests") && sql.contains("Status = 'APPROVED'")) value = 5;
                else if (sql.contains("PTSessions") && sql.contains("Status = 'SCHEDULED'")) value = 4;
                else if (sql.contains("OrderInvoices") && sql.contains("PickedUpAt IS NULL")) value = 3;
                else if (sql.contains("CAST(PickedUpAt AS DATE) = ?")) value = 1;
                else if (sql.contains("OrderInvoices") && sql.contains("EmailSendError IS NOT NULL")) value = 1;
                else if (sql.contains("dbo.Promotions")) value = 2;
                else if (sql.contains("dbo.PromotionPosts")) value = 1;
                else value = 0;
                return (T) value;
            }
            if (BigDecimal.class.equals(requiredType)) {
                BigDecimal value = switch (moneyQueryIndex++) {
                    case 0 -> new BigDecimal("1200.00");
                    case 1 -> new BigDecimal("7200.00");
                    default -> new BigDecimal("15000.00");
                };
                return (T) value;
            }
            return null;
        }

        @SuppressWarnings("unchecked")
        private <T> List<T> resolveList(String sql) {
            if (sql.contains("TOP (5)") && sql.contains("p.PaymentID")) {
                return (List<T>) List.of(Map.of(
                        "paymentId", 100,
                        "amount", new BigDecimal("2500.00"),
                        "paidAt", "2026-03-07T08:30:00",
                        "paymentTarget", "ORDER",
                        "customerName", "Customer Minh",
                        "currency", "VND"));
            }
            if (sql.contains("FROM dbo.OrderInvoices") && sql.contains("PickedUpAt IS NULL") && sql.contains("InvoiceCode")) {
                return (List<T>) List.of(Map.of(
                        "invoiceId", 10,
                        "invoiceCode", "INV-10",
                        "orderId", 55,
                        "recipientName", "Customer Minh",
                        "totalAmount", new BigDecimal("1800.00"),
                        "paidAt", "2026-03-07T08:31:00",
                        "currency", "VND"));
            }
            if (sql.contains("cm.EndDate >= ?") && sql.contains("cm.EndDate <= ?")) {
                return (List<T>) List.of(Map.of(
                        "customerMembershipId", 20,
                        "customerName", "Customer Minh",
                        "planName", "Gym + Coach - 6 Months",
                        "endDate", "2026-03-10"));
            }
            if (sql.contains("FROM dbo.PTRecurringRequests request")) {
                return (List<T>) List.of(Map.of(
                        "ptRequestId", 30,
                        "customerName", "Customer Minh",
                        "coachName", "Coach Alex",
                        "createdAt", "2026-03-07T08:35:00"));
            }
            if (sql.contains("EmailSendError IS NOT NULL")) {
                return (List<T>) List.of(Map.of(
                        "invoiceId", 12,
                        "invoiceCode", "INV-12",
                        "recipientEmail", "customer@gymcore.local",
                        "emailSendError", "SMTP failed",
                        "paidAt", "2026-03-07T08:40:00"));
            }
            if (sql.contains("GROUP BY CAST(COALESCE(PaidAt, CreatedAt) AS DATE)")) {
                return (List<T>) List.of(
                        Map.of("date", "2026-03-05", "productRevenue", new BigDecimal("1000.00"), "membershipRevenue", new BigDecimal("2000.00"), "totalRevenue", new BigDecimal("3000.00")),
                        Map.of("date", "2026-03-07", "productRevenue", new BigDecimal("1500.00"), "membershipRevenue", new BigDecimal("2500.00"), "totalRevenue", new BigDecimal("4000.00")));
            }
            return List.of();
        }
    }

    private static final class MissingPickupDashboardJdbcTemplate extends FakeDashboardJdbcTemplate {

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            if (Integer.class.equals(requiredType) && sql.contains("INFORMATION_SCHEMA.COLUMNS")) {
                return requiredType.cast(0);
            }
            return super.queryForObject(sql, requiredType, args);
        }

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType) {
            if (Integer.class.equals(requiredType) && sql.contains("INFORMATION_SCHEMA.COLUMNS")) {
                return requiredType.cast(0);
            }
            return super.queryForObject(sql, requiredType);
        }
    }
}
