package com.gymcore.backend.modules.admin.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminService {

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;

    public AdminService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
    }

    public Map<String, Object> execute(String action, String authorizationHeader, Object payload) {
        currentUserService.requireAdmin(authorizationHeader);
        Map<String, Object> safePayload = payload == null ? Map.of() : castToMap(payload);
        return switch (action) {
            case "get-dashboard-summary" -> getDashboardSummary();
            case "get-revenue-overview" -> getRevenueOverview(safePayload);
            case "get-product-revenue" -> getProductRevenue(safePayload);
            case "get-coach-feedback" -> getCoachFeedback();
            case "get-coach-students" -> getCoachStudents();
            default -> throw unsupportedAction(action);
        };
    }

    public RevenueExport exportRevenueExcel(String authorizationHeader, Map<String, Object> filters) {
        currentUserService.requireAdmin(authorizationHeader);
        RevenueOverviewData overview = buildRevenueOverview(resolveRevenueRange(filters == null ? Map.of() : filters));
        return new RevenueExport(buildRevenueExportFileName(overview.range()), buildRevenueWorkbook(overview));
    }

    /**
     * Quick revenue report for PAID product orders.
     * Uses Payments joined with Orders and Users.
     *
     * Input filters (optional, ISO dates):
     * - from: yyyy-MM-dd
     * - to: yyyy-MM-dd
     */
    private Map<String, Object> getProductRevenue(Map<String, Object> filters) {
        LocalDate from = parseDateOrNull(filters.get("from"));
        LocalDate to = parseDateOrNull(filters.get("to"));

        StringBuilder sql = new StringBuilder("""
                SELECT
                    o.OrderID,
                    o.OrderDate,
                    o.TotalAmount,
                    u.FullName AS CustomerName
                FROM dbo.Orders o
                JOIN dbo.Payments pay ON pay.OrderID = o.OrderID
                JOIN dbo.Customers c ON c.CustomerID = o.CustomerID
                JOIN dbo.Users u ON u.UserID = c.CustomerID
                WHERE pay.Status = 'SUCCESS'
                """);

        if (from != null) {
            sql.append(" AND CAST(COALESCE(pay.PaidAt, pay.CreatedAt) AS DATE) >= ? ");
        }
        if (to != null) {
            sql.append(" AND CAST(COALESCE(pay.PaidAt, pay.CreatedAt) AS DATE) <= ? ");
        }
        sql.append(" ORDER BY COALESCE(pay.PaidAt, pay.CreatedAt) DESC, o.OrderID DESC ");

        Object[] params;
        if (from != null && to != null) {
            params = new Object[] { from, to };
        } else if (from != null) {
            params = new Object[] { from };
        } else if (to != null) {
            params = new Object[] { to };
        } else {
            params = new Object[] {};
        }

        List<Map<String, Object>> orders = jdbcTemplate.query(
                con -> {
                    var ps = con.prepareStatement(sql.toString());
                    for (int i = 0; i < params.length; i++) {
                        Object value = params[i];
                        if (value instanceof LocalDate date) {
                            ps.setObject(i + 1, date);
                        } else {
                            ps.setObject(i + 1, value);
                        }
                    }
                    return ps;
                },
                (rs, rowNum) -> mapPaidOrder(rs));

        BigDecimal totalRevenue = BigDecimal.ZERO;
        for (Map<String, Object> order : orders) {
            BigDecimal amount = (BigDecimal) order.getOrDefault("totalAmount", BigDecimal.ZERO);
            totalRevenue = totalRevenue.add(amount);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("currency", "VND");
        summary.put("count", orders.size());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", summary);
        response.put("orders", orders);
        return response;
    }

    private Map<String, Object> getDashboardSummary() {
        LocalDate today = LocalDate.now();
        LocalDate nextWeek = today.plusDays(7);
        boolean invoiceTableAvailable = tableExists("OrderInvoices");
        boolean pickupTrackingAvailable = invoiceTableAvailable && columnExists("OrderInvoices", "PickedUpAt");
        boolean invoiceEmailTrackingAvailable = invoiceTableAvailable
                && columnExists("OrderInvoices", "EmailSendError")
                && columnExists("OrderInvoices", "EmailSentAt");

        Map<String, Object> customerMetrics = Map.of(
                "totalCustomers", queryInt("SELECT COUNT(1) FROM dbo.Customers"),
                "activeCustomers", queryInt("""
                        SELECT COUNT(DISTINCT cm.CustomerID)
                        FROM dbo.CustomerMemberships cm
                        WHERE cm.Status = 'ACTIVE'
                        """));

        Map<String, Object> membershipMetrics = Map.of(
                "activeMemberships", queryInt("SELECT COUNT(1) FROM dbo.CustomerMemberships WHERE Status = 'ACTIVE'"),
                "scheduledMemberships", queryInt("SELECT COUNT(1) FROM dbo.CustomerMemberships WHERE Status = 'SCHEDULED'"),
                "expiringSoonMemberships", queryInt("""
                        SELECT COUNT(1)
                        FROM dbo.CustomerMemberships
                        WHERE Status = 'ACTIVE'
                          AND EndDate >= ?
                          AND EndDate <= ?
                        """, today, nextWeek));

        int totalCoaches = queryInt("""
                SELECT COUNT(1)
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                WHERE r.RoleName = 'Coach'
                """);
        int totalReceptionists = queryInt("""
                SELECT COUNT(1)
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                WHERE r.RoleName = 'Receptionist'
                """);
        int totalAdmins = queryInt("""
                SELECT COUNT(1)
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                WHERE r.RoleName = 'Admin'
                """);
        int lockedStaffAccounts = queryInt("""
                SELECT COUNT(1)
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                WHERE r.RoleName IN ('Admin', 'Coach', 'Receptionist')
                  AND u.IsLocked = 1
                """);

        Map<String, Object> staffMetrics = Map.of(
                "totalCoaches", totalCoaches,
                "totalReceptionists", totalReceptionists,
                "totalAdmins", totalAdmins,
                "lockedStaffAccounts", lockedStaffAccounts);

        Map<String, Object> ptMetrics = Map.of(
                "pendingPtRequests", queryInt("SELECT COUNT(1) FROM dbo.PTRecurringRequests WHERE Status = 'PENDING'"),
                "activePtArrangements", queryInt("""
                        SELECT COUNT(1)
                        FROM dbo.PTRecurringRequests
                        WHERE Status = 'APPROVED'
                          AND EndDate >= ?
                        """, today),
                "sessionsScheduledToday", queryInt("""
                        SELECT COUNT(1)
                        FROM dbo.PTSessions
                        WHERE SessionDate = ?
                          AND Status = 'SCHEDULED'
                        """, today));

        int awaitingPickupOrders = pickupTrackingAvailable
                ? queryInt("SELECT COUNT(1) FROM dbo.OrderInvoices WHERE PickedUpAt IS NULL")
                : 0;
        int pickedUpToday = pickupTrackingAvailable
                ? queryInt("""
                        SELECT COUNT(1)
                        FROM dbo.OrderInvoices
                        WHERE CAST(PickedUpAt AS DATE) = ?
                        """, today)
                : 0;
        int invoiceEmailFailures = invoiceEmailTrackingAvailable
                ? queryInt("""
                        SELECT COUNT(1)
                        FROM dbo.OrderInvoices
                        WHERE EmailSendError IS NOT NULL
                          AND EmailSentAt IS NULL
                        """)
                : 0;

        Map<String, Object> commerceMetrics = new LinkedHashMap<>();
        commerceMetrics.put("awaitingPickupOrders", awaitingPickupOrders);
        commerceMetrics.put("pickedUpToday", pickedUpToday);
        commerceMetrics.put("invoiceEmailFailures", invoiceEmailFailures);
        commerceMetrics.put("pickupTrackingAvailable", pickupTrackingAvailable);
        commerceMetrics.put("invoiceEmailTrackingAvailable", invoiceEmailTrackingAvailable);

        Map<String, Object> promotionMetrics = Map.of(
                "activeCoupons", queryInt("""
                        SELECT COUNT(1)
                        FROM dbo.Promotions
                        WHERE IsActive = 1
                          AND ValidFrom <= SYSDATETIME()
                          AND ValidTo >= SYSDATETIME()
                        """),
                "activePromotionPosts", queryInt("""
                        SELECT COUNT(1)
                        FROM dbo.PromotionPosts
                        WHERE IsActive = 1
                          AND StartAt <= SYSDATETIME()
                          AND EndAt >= SYSDATETIME()
                        """));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("customerMetrics", customerMetrics);
        response.put("membershipMetrics", membershipMetrics);
        response.put("staffMetrics", staffMetrics);
        response.put("ptMetrics", ptMetrics);
        response.put("commerceMetrics", commerceMetrics);
        response.put("promotionMetrics", promotionMetrics);
        response.put("recentPayments", getRecentPayments());
        response.put("awaitingPickupOrders", pickupTrackingAvailable ? getAwaitingPickupOrders() : List.of());
        response.put("expiringMemberships", getExpiringMemberships(today, nextWeek));
        response.put("pendingPtRequests", getPendingPtRequests());
        response.put("invoiceEmailFailures", invoiceEmailTrackingAvailable ? getRecentInvoiceFailures() : List.of());
        response.put("alerts", buildAlerts(customerMetrics, membershipMetrics, staffMetrics, ptMetrics, commerceMetrics,
                promotionMetrics));
        return response;
    }

    private Map<String, Object> getRevenueOverview(Map<String, Object> filters) {
        RevenueOverviewData overview = buildRevenueOverview(resolveRevenueRange(filters));

        Map<String, Object> rangeInfo = new LinkedHashMap<>();
        rangeInfo.put("preset", overview.range().preset());
        rangeInfo.put("from", overview.range().from().toString());
        rangeInfo.put("to", overview.range().to().toString());

        Map<String, Object> tiles = new LinkedHashMap<>();
        tiles.put("todayRevenue", overview.todayRevenue());
        tiles.put("last7DaysRevenue", overview.last7DaysRevenue());
        tiles.put("monthToDateRevenue", overview.monthToDateRevenue());
        tiles.put("selectedRangeRevenue", overview.selectedRangeRevenue());

        Map<String, Object> split = new LinkedHashMap<>();
        split.put("products", overview.productRangeRevenue());
        split.put("memberships", overview.membershipRangeRevenue());

        List<Map<String, Object>> series = new ArrayList<>();
        for (RevenuePoint point : overview.series()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", point.date().toString());
            row.put("productRevenue", point.productRevenue());
            row.put("membershipRevenue", point.membershipRevenue());
            row.put("totalRevenue", point.totalRevenue());
            series.add(row);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("range", rangeInfo);
        response.put("tiles", tiles);
        response.put("split", split);
        response.put("series", series);
        response.put("currency", "VND");
        return response;
    }

    private RevenueOverviewData buildRevenueOverview(RevenueRange range) {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = YearMonth.from(today).atDay(1);

        BigDecimal todayRevenue = sumSuccessfulPayments(today, today);
        BigDecimal last7DaysRevenue = sumSuccessfulPayments(today.minusDays(6), today);
        BigDecimal monthToDateRevenue = sumSuccessfulPayments(monthStart, today);

        List<Map<String, Object>> rawSeries = jdbcTemplate.query("""
                SELECT
                    CAST(COALESCE(PaidAt, CreatedAt) AS DATE) AS RevenueDate,
                    SUM(CASE WHEN OrderID IS NOT NULL THEN Amount ELSE 0 END) AS ProductRevenue,
                    SUM(CASE WHEN CustomerMembershipID IS NOT NULL THEN Amount ELSE 0 END) AS MembershipRevenue,
                    SUM(Amount) AS TotalRevenue
                FROM dbo.Payments
                WHERE Status = 'SUCCESS'
                  AND COALESCE(PaidAt, CreatedAt) >= ?
                  AND COALESCE(PaidAt, CreatedAt) < DATEADD(DAY, 1, ?)
                GROUP BY CAST(COALESCE(PaidAt, CreatedAt) AS DATE)
                ORDER BY RevenueDate ASC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", rs.getDate("RevenueDate").toLocalDate().toString());
            row.put("productRevenue", rs.getBigDecimal("ProductRevenue"));
            row.put("membershipRevenue", rs.getBigDecimal("MembershipRevenue"));
            row.put("totalRevenue", rs.getBigDecimal("TotalRevenue"));
            return row;
        }, range.from(), range.to());

        Map<LocalDate, RevenuePoint> seriesByDate = new LinkedHashMap<>();
        for (Map<String, Object> row : rawSeries) {
            LocalDate date = LocalDate.parse(String.valueOf(row.get("date")));
            seriesByDate.put(
                    date,
                    new RevenuePoint(
                            date,
                            (BigDecimal) row.getOrDefault("productRevenue", BigDecimal.ZERO),
                            (BigDecimal) row.getOrDefault("membershipRevenue", BigDecimal.ZERO),
                            (BigDecimal) row.getOrDefault("totalRevenue", BigDecimal.ZERO)));
        }

        List<RevenuePoint> series = new ArrayList<>();
        BigDecimal productRangeRevenue = BigDecimal.ZERO;
        BigDecimal membershipRangeRevenue = BigDecimal.ZERO;
        BigDecimal selectedRangeRevenue = BigDecimal.ZERO;

        for (LocalDate cursor = range.from(); !cursor.isAfter(range.to()); cursor = cursor.plusDays(1)) {
            RevenuePoint row = seriesByDate.get(cursor);
            BigDecimal productRevenue = row == null
                    ? BigDecimal.ZERO
                    : row.productRevenue();
            BigDecimal membershipRevenue = row == null
                    ? BigDecimal.ZERO
                    : row.membershipRevenue();
            BigDecimal totalRevenue = row == null
                    ? BigDecimal.ZERO
                    : row.totalRevenue();

            productRangeRevenue = productRangeRevenue.add(productRevenue);
            membershipRangeRevenue = membershipRangeRevenue.add(membershipRevenue);
            selectedRangeRevenue = selectedRangeRevenue.add(totalRevenue);

            series.add(new RevenuePoint(cursor, productRevenue, membershipRevenue, totalRevenue));
        }

        return new RevenueOverviewData(
                range,
                todayRevenue,
                last7DaysRevenue,
                monthToDateRevenue,
                selectedRangeRevenue,
                productRangeRevenue,
                membershipRangeRevenue,
                series);
    }

    private byte[] buildRevenueWorkbook(RevenueOverviewData overview) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle moneyStyle = createMoneyStyle(workbook);

            Sheet summarySheet = workbook.createSheet("Summary");
            int summaryRowIndex = 0;
            summaryRowIndex = writeSummaryRow(summarySheet, summaryRowIndex, "Revenue report", "GymCore");
            summaryRowIndex = writeSummaryRow(summarySheet, summaryRowIndex, "Applied filter", describeRevenueRange(overview.range()));
            summaryRowIndex = writeSummaryRow(summarySheet, summaryRowIndex, "From", overview.range().from().toString());
            summaryRowIndex = writeSummaryRow(summarySheet, summaryRowIndex, "To", overview.range().to().toString());
            summaryRowIndex++;
            summaryRowIndex = writeSummaryMoneyRow(summarySheet, summaryRowIndex, "Total revenue", overview.selectedRangeRevenue(), moneyStyle);
            summaryRowIndex = writeSummaryMoneyRow(summarySheet, summaryRowIndex, "Membership revenue", overview.membershipRangeRevenue(), moneyStyle);
            summaryRowIndex = writeSummaryMoneyRow(summarySheet, summaryRowIndex, "Product revenue", overview.productRangeRevenue(), moneyStyle);
            summaryRowIndex = writeSummaryMoneyRow(
                    summarySheet,
                    summaryRowIndex,
                    "Average per day",
                    overview.series().isEmpty()
                            ? BigDecimal.ZERO
                            : overview.selectedRangeRevenue().divide(BigDecimal.valueOf(overview.series().size()), 2, RoundingMode.HALF_UP),
                    moneyStyle);
            summarySheet.autoSizeColumn(0);
            summarySheet.autoSizeColumn(1);

            Sheet dailySheet = workbook.createSheet("Daily Revenue");
            Row header = dailySheet.createRow(0);
            writeCell(header, 0, "Date", headerStyle);
            writeCell(header, 1, "Membership revenue", headerStyle);
            writeCell(header, 2, "Product revenue", headerStyle);
            writeCell(header, 3, "Total revenue", headerStyle);

            int rowIndex = 1;
            for (RevenuePoint point : overview.series()) {
                Row row = dailySheet.createRow(rowIndex++);
                writeCell(row, 0, point.date().toString(), null);
                writeMoneyCell(row, 1, point.membershipRevenue(), moneyStyle);
                writeMoneyCell(row, 2, point.productRevenue(), moneyStyle);
                writeMoneyCell(row, 3, point.totalRevenue(), moneyStyle);
            }

            for (int column = 0; column < 4; column++) {
                dailySheet.autoSizeColumn(column);
            }

            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate revenue export.");
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());

        CellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setFillForegroundColor(IndexedColors.DARK_GREEN.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private CellStyle createMoneyStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
        return style;
    }

    private int writeSummaryRow(Sheet sheet, int rowIndex, String label, String value) {
        Row row = sheet.createRow(rowIndex);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value);
        return rowIndex + 1;
    }

    private int writeSummaryMoneyRow(Sheet sheet, int rowIndex, String label, BigDecimal value, CellStyle moneyStyle) {
        Row row = sheet.createRow(rowIndex);
        row.createCell(0).setCellValue(label);
        writeMoneyCell(row, 1, value, moneyStyle);
        return rowIndex + 1;
    }

    private void writeCell(Row row, int columnIndex, String value, CellStyle style) {
        var cell = row.createCell(columnIndex);
        cell.setCellValue(value);
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    private void writeMoneyCell(Row row, int columnIndex, BigDecimal value, CellStyle style) {
        var cell = row.createCell(columnIndex);
        cell.setCellValue(value == null ? 0D : value.doubleValue());
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    private String describeRevenueRange(RevenueRange range) {
        return switch (range.preset()) {
            case "today" -> "Today";
            case "7d" -> "Last 7 days";
            case "30d" -> "Last 30 days";
            case "month" -> "This month";
            case "month-detail" -> range.from().getYear() + "-" + String.format("%02d", range.from().getMonthValue());
            case "year" -> String.valueOf(range.from().getYear());
            default -> range.from() + " to " + range.to();
        };
    }

    private String buildRevenueExportFileName(RevenueRange range) {
        return switch (range.preset()) {
            case "today" -> "GymCore_Revenue_Today_" + range.from() + ".xlsx";
            case "7d" -> "GymCore_Revenue_Last-7-days_" + range.from() + "_to_" + range.to() + ".xlsx";
            case "30d" -> "GymCore_Revenue_Last-30-days_" + range.from() + "_to_" + range.to() + ".xlsx";
            case "month" -> "GymCore_Revenue_This-month_" + range.from() + "_to_" + range.to() + ".xlsx";
            case "month-detail" -> "GymCore_Revenue_" + range.from().getYear() + "-"
                    + String.format("%02d", range.from().getMonthValue()) + ".xlsx";
            case "year" -> "GymCore_Revenue_" + range.from().getYear() + ".xlsx";
            default -> "GymCore_Revenue_" + range.from() + "_to_" + range.to() + ".xlsx";
        };
    }

    private Map<String, Object> getCoachFeedback() {
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT c.CoachID, u.FullName,
                               COALESCE(AVG(CAST(cf.Rating AS FLOAT)), 0) AS AverageRating,
                               COUNT(cf.CoachFeedbackID) AS ReviewCount
                        FROM dbo.Coaches c
                        JOIN dbo.Users u ON u.UserID = c.CoachID
                        LEFT JOIN dbo.CoachFeedback cf ON cf.CoachID = c.CoachID
                        GROUP BY c.CoachID, u.FullName
                        ORDER BY AverageRating DESC, ReviewCount DESC, u.FullName
                        """,
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("coachId", rs.getInt("CoachID"));
                    m.put("coachName", rs.getString("FullName"));
                    m.put("averageRating", Math.round(rs.getDouble("AverageRating") * 100.0) / 100.0);
                    m.put("reviewCount", rs.getInt("ReviewCount"));
                    return m;
                });
        return Map.of("items", items);
    }

    private Map<String, Object> getCoachStudents() {
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                        SELECT c.CoachID, u.FullName,
                               COUNT(DISTINCT s.CustomerID) AS StudentCount
                        FROM dbo.Coaches c
                        JOIN dbo.Users u ON u.UserID = c.CoachID
                        LEFT JOIN dbo.PTSessions s
                               ON s.CoachID = c.CoachID
                              AND s.Status IN ('SCHEDULED','COMPLETED')
                        GROUP BY c.CoachID, u.FullName
                        ORDER BY StudentCount DESC, u.FullName
                        """,
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("coachId", rs.getInt("CoachID"));
                    m.put("coachName", rs.getString("FullName"));
                    m.put("studentCount", rs.getInt("StudentCount"));
                    return m;
                });
        return Map.of("items", items);
    }

    private Map<String, Object> mapPaidOrder(ResultSet rs) throws SQLException {
        Map<String, Object> order = new LinkedHashMap<>();
        order.put("orderId", rs.getInt("OrderID"));
        order.put("orderDate", rs.getTimestamp("OrderDate"));
        order.put("totalAmount", rs.getBigDecimal("TotalAmount"));
        order.put("customerName", rs.getString("CustomerName"));
        order.put("currency", "VND");
        return order;
    }

    private List<Map<String, Object>> getRecentPayments() {
        return jdbcTemplate.query("""
                SELECT TOP (5)
                    p.PaymentID,
                    p.Amount,
                    COALESCE(p.PaidAt, p.CreatedAt) AS EffectivePaidAt,
                    CASE WHEN p.OrderID IS NOT NULL THEN 'ORDER' ELSE 'MEMBERSHIP' END AS PaymentTarget,
                    COALESCE(orderUser.FullName, membershipUser.FullName) AS CustomerName
                FROM dbo.Payments p
                LEFT JOIN dbo.Orders o ON o.OrderID = p.OrderID
                LEFT JOIN dbo.Users orderUser ON orderUser.UserID = o.CustomerID
                LEFT JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                LEFT JOIN dbo.Users membershipUser ON membershipUser.UserID = cm.CustomerID
                WHERE p.Status = 'SUCCESS'
                ORDER BY COALESCE(p.PaidAt, p.CreatedAt) DESC, p.PaymentID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("paymentId", rs.getInt("PaymentID"));
            row.put("amount", rs.getBigDecimal("Amount"));
            row.put("paidAt", rs.getTimestamp("EffectivePaidAt"));
            row.put("paymentTarget", rs.getString("PaymentTarget"));
            row.put("customerName", rs.getString("CustomerName"));
            row.put("currency", "VND");
            return row;
        });
    }

    private List<Map<String, Object>> getAwaitingPickupOrders() {
        return jdbcTemplate.query("""
                SELECT TOP (5)
                    InvoiceID,
                    InvoiceCode,
                    OrderID,
                    RecipientName,
                    TotalAmount,
                    PaidAt
                FROM dbo.OrderInvoices
                WHERE PickedUpAt IS NULL
                ORDER BY PaidAt DESC, InvoiceID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("invoiceId", rs.getInt("InvoiceID"));
            row.put("invoiceCode", rs.getString("InvoiceCode"));
            row.put("orderId", rs.getInt("OrderID"));
            row.put("recipientName", rs.getString("RecipientName"));
            row.put("totalAmount", rs.getBigDecimal("TotalAmount"));
            row.put("paidAt", rs.getTimestamp("PaidAt"));
            row.put("currency", "VND");
            return row;
        });
    }

    private List<Map<String, Object>> getExpiringMemberships(LocalDate today, LocalDate nextWeek) {
        return jdbcTemplate.query("""
                SELECT TOP (5)
                    cm.CustomerMembershipID,
                    u.FullName,
                    mp.PlanName,
                    cm.EndDate
                FROM dbo.CustomerMemberships cm
                JOIN dbo.Users u ON u.UserID = cm.CustomerID
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.Status = 'ACTIVE'
                  AND cm.EndDate >= ?
                  AND cm.EndDate <= ?
                ORDER BY cm.EndDate ASC, cm.CustomerMembershipID ASC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("customerMembershipId", rs.getInt("CustomerMembershipID"));
            row.put("customerName", rs.getString("FullName"));
            row.put("planName", rs.getString("PlanName"));
            row.put("endDate", rs.getDate("EndDate").toLocalDate().toString());
            return row;
        }, today, nextWeek);
    }

    private List<Map<String, Object>> getPendingPtRequests() {
        return jdbcTemplate.query("""
                SELECT TOP (5)
                    request.PTRequestID,
                    customer.FullName AS CustomerName,
                    coach.FullName AS CoachName,
                    request.StartDate,
                    request.EndDate,
                    request.CreatedAt
                FROM dbo.PTRecurringRequests request
                JOIN dbo.Users customer ON customer.UserID = request.CustomerID
                LEFT JOIN dbo.Users coach ON coach.UserID = request.CoachID
                WHERE request.Status = 'PENDING'
                ORDER BY request.CreatedAt DESC, request.PTRequestID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("ptRequestId", rs.getInt("PTRequestID"));
            row.put("customerName", rs.getString("CustomerName"));
            row.put("coachName", rs.getString("CoachName"));
            row.put("startDate", rs.getDate("StartDate") == null ? null : rs.getDate("StartDate").toLocalDate().toString());
            row.put("endDate", rs.getDate("EndDate") == null ? null : rs.getDate("EndDate").toLocalDate().toString());
            row.put("createdAt", rs.getTimestamp("CreatedAt"));
            return row;
        });
    }

    private List<Map<String, Object>> getRecentInvoiceFailures() {
        return jdbcTemplate.query("""
                SELECT TOP (5)
                    InvoiceID,
                    InvoiceCode,
                    RecipientEmail,
                    EmailSendError,
                    PaidAt
                FROM dbo.OrderInvoices
                WHERE EmailSendError IS NOT NULL
                ORDER BY PaidAt DESC, InvoiceID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("invoiceId", rs.getInt("InvoiceID"));
            row.put("invoiceCode", rs.getString("InvoiceCode"));
            row.put("recipientEmail", rs.getString("RecipientEmail"));
            row.put("emailSendError", rs.getString("EmailSendError"));
            row.put("paidAt", rs.getTimestamp("PaidAt"));
            return row;
        });
    }

    private List<Map<String, Object>> buildAlerts(
            Map<String, Object> customerMetrics,
            Map<String, Object> membershipMetrics,
            Map<String, Object> staffMetrics,
            Map<String, Object> ptMetrics,
            Map<String, Object> commerceMetrics,
            Map<String, Object> promotionMetrics) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        addAlert(alerts, "pickup-queue", "info",
                asInt(commerceMetrics.get("awaitingPickupOrders")),
                "Orders are waiting at the pickup desk.",
                count -> count + " paid product orders are still awaiting pickup.");
        addAlert(alerts, "invoice-email-failures", "warning",
                asInt(commerceMetrics.get("invoiceEmailFailures")),
                "Invoice email delivery failures need attention.",
                count -> count + " product receipts failed email delivery.");
        addAlert(alerts, "expiring-memberships", "warning",
                asInt(membershipMetrics.get("expiringSoonMemberships")),
                "Memberships are expiring soon.",
                count -> count + " active memberships will expire in the next 7 days.");
        addAlert(alerts, "pending-pt", "info",
                asInt(ptMetrics.get("pendingPtRequests")),
                "Pending PT requests are waiting for review.",
                count -> count + " PT requests are still pending approval.");
        addAlert(alerts, "locked-staff", "warning",
                asInt(staffMetrics.get("lockedStaffAccounts")),
                "Some staff accounts are locked.",
                count -> count + " staff accounts are currently locked.");
        addAlert(alerts, "inactive-coupons", "neutral",
                asInt(promotionMetrics.get("activeCoupons")) == 0 ? 1 : 0,
                "No active coupons are currently running.",
                count -> "There are no active coupons available for customers right now.");
        return alerts;
    }

    private void addAlert(
            List<Map<String, Object>> alerts,
            String key,
            String severity,
            int count,
            String title,
            Function<Integer, String> messageFactory) {
        if (count <= 0) {
            return;
        }
        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("key", key);
        alert.put("severity", severity);
        alert.put("count", count);
        alert.put("title", title);
        alert.put("message", messageFactory.apply(count));
        alerts.add(alert);
    }

    private BigDecimal sumSuccessfulPayments(LocalDate from, LocalDate to) {
        return queryMoney("""
                SELECT COALESCE(SUM(Amount), 0)
                FROM dbo.Payments
                WHERE Status = 'SUCCESS'
                  AND COALESCE(PaidAt, CreatedAt) >= ?
                  AND COALESCE(PaidAt, CreatedAt) < DATEADD(DAY, 1, ?)
                """, from, to);
    }

    private RevenueRange resolveRevenueRange(Map<String, Object> filters) {
        LocalDate explicitFrom = parseDateOrNull(filters.get("from"));
        LocalDate explicitTo = parseDateOrNull(filters.get("to"));
        String preset = normalizePreset(filters.get("preset"));
        YearMonth explicitMonth = parseYearMonthOrNull(filters.get("month"));
        Year explicitYear = parseYearOrNull(filters.get("year"));

        if (explicitFrom != null && explicitTo != null) {
            if (explicitFrom.isAfter(explicitTo)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "From date must be on or before to date.");
            }
            return new RevenueRange(explicitFrom, explicitTo, preset == null ? "custom" : preset);
        }

        LocalDate today = LocalDate.now();
        String resolvedPreset = preset == null ? "30d" : preset;
        return switch (resolvedPreset) {
            case "today" -> new RevenueRange(today, today, resolvedPreset);
            case "7d" -> new RevenueRange(today.minusDays(6), today, resolvedPreset);
            case "30d" -> new RevenueRange(today.minusDays(29), today, resolvedPreset);
            case "month" -> new RevenueRange(YearMonth.from(today).atDay(1), today, resolvedPreset);
            case "month-detail" -> {
                YearMonth month = explicitMonth == null ? YearMonth.from(today) : explicitMonth;
                yield new RevenueRange(month.atDay(1), month.atEndOfMonth(), resolvedPreset);
            }
            case "year" -> {
                Year year = explicitYear == null ? Year.from(today) : explicitYear;
                yield new RevenueRange(year.atDay(1), year.atMonth(12).atEndOfMonth(), resolvedPreset);
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported revenue preset.");
        };
    }

    private String normalizePreset(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim().toLowerCase();
        return text.isEmpty() ? null : text;
    }

    private LocalDate parseDateOrNull(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format. Use yyyy-MM-dd.");
        }
    }

    private YearMonth parseYearMonthOrNull(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return YearMonth.parse(text);
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month format. Use yyyy-MM.");
        }
    }

    private Year parseYearOrNull(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Year.parse(text);
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid year format. Use yyyy.");
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castToMap(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private ResponseStatusException unsupportedAction(String action) {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Unsupported admin action: " + action);
    }

    private int queryInt(String sql, Object... params) {
        Integer value = jdbcTemplate.queryForObject(sql, Integer.class, params);
        return value == null ? 0 : value;
    }

    private BigDecimal queryMoney(String sql, Object... params) {
        BigDecimal value = jdbcTemplate.queryForObject(sql, BigDecimal.class, params);
        return value == null ? BigDecimal.ZERO : value;
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = 'dbo'
                  AND TABLE_NAME = ?
                """, Integer.class, tableName);
        return count != null && count > 0;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    private int asInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    public record RevenueExport(String fileName, byte[] content) {
    }

    private record RevenueRange(LocalDate from, LocalDate to, String preset) {
    }

    private record RevenuePoint(LocalDate date, BigDecimal productRevenue, BigDecimal membershipRevenue, BigDecimal totalRevenue) {
    }

    private record RevenueOverviewData(
            RevenueRange range,
            BigDecimal todayRevenue,
            BigDecimal last7DaysRevenue,
            BigDecimal monthToDateRevenue,
            BigDecimal selectedRangeRevenue,
            BigDecimal productRangeRevenue,
            BigDecimal membershipRangeRevenue,
            List<RevenuePoint> series) {
    }
}
