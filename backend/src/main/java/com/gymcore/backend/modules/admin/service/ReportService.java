package com.gymcore.backend.modules.admin.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ReportService {

    private final JdbcTemplate jdbcTemplate;

    public ReportService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> getRevenueReport() {
        String productOrdersSql = "SELECT * FROM dbo.vw_Revenue_ProductOrders ORDER BY RevenueDate DESC";
        String membershipsSql = "SELECT * FROM dbo.vw_Revenue_Memberships ORDER BY RevenueDate DESC";

        List<Map<String, Object>> productRevenue = jdbcTemplate.queryForList(productOrdersSql);
        List<Map<String, Object>> membershipRevenue = jdbcTemplate.queryForList(membershipsSql);

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("productOrders", productRevenue);
        report.put("memberships", membershipRevenue);
        report.put("generatedAt", java.time.LocalDateTime.now().toString());

        return report;
    }

    public byte[] exportRevenueToPdf() {
        // Simple PDF export logic (using standard text for now or simple generator)
        // In a real project, we'd use iText or similar.
        // Here we'll return a simple mock PDF byte array or a text content as bytes.
        StringBuilder sb = new StringBuilder();
        sb.append("GYM CORE - REVENUE REPORT\n");
        sb.append("=========================\n\n");

        Map<String, Object> report = getRevenueReport();
        sb.append("Generated At: ").append(report.get("generatedAt")).append("\n\n");

        sb.append("Product Orders Revenue:\n");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("productOrders");
        for (Map<String, Object> row : products) {
            sb.append(String.format("Date: %s | Amount: %s | Orders: %s\n",
                    row.get("RevenueDate"), row.get("RevenueAmount"), row.get("PaidOrders")));
        }

        sb.append("\nMembership Revenue:\n");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> memberships = (List<Map<String, Object>>) report.get("memberships");
        for (Map<String, Object> row : memberships) {
            sb.append(String.format("Date: %s | Amount: %s | Count: %s\n",
                    row.get("RevenueDate"), row.get("RevenueAmount"), row.get("PaidMemberships")));
        }

        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
