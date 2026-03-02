package com.gymcore.backend.modules.admin.service;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminService {

    private final JdbcTemplate jdbcTemplate;

    public AdminService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> safePayload = payload == null ? Map.of() : castToMap(payload);
        return switch (action) {
            case "get-product-revenue" -> getProductRevenue(safePayload);
            case "get-coach-feedback" -> getCoachFeedback();
            case "get-coach-students" -> getCoachStudents();
            default -> throw unsupportedAction(action);
        };
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
            sql.append(" AND CAST(pay.PaidAt AS DATE) >= ? ");
        }
        if (to != null) {
            sql.append(" AND CAST(pay.PaidAt AS DATE) <= ? ");
        }
        sql.append(" ORDER BY pay.PaidAt DESC, o.OrderID DESC ");

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
}
