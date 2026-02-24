package com.gymcore.backend.modules.admin.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
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
        report.put("generatedAt", LocalDateTime.now().toString());

        return report;
    }

    public byte[] exportRevenueToPdf() {
        Map<String, Object> report = getRevenueReport();
        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Fonts
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, java.awt.Color.BLACK);
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, java.awt.Color.DARK_GRAY);
            Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 10, java.awt.Color.BLACK);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, java.awt.Color.WHITE);

            // Header
            Paragraph title = new Paragraph("GYM CORE - REVENUE REPORT", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(10);
            document.add(title);

            Paragraph date = new Paragraph("Generated At: " + report.get("generatedAt"), normalFont);
            date.setAlignment(Element.ALIGN_CENTER);
            date.setSpacingAfter(20);
            document.add(date);

            // Summary Section
            document.add(new Paragraph("Revenue Summary", subTitleFont));
            document.add(new Paragraph("\n", normalFont));

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("productOrders");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> memberships = (List<Map<String, Object>>) report.get("memberships");

            double totalProducts = products.stream().mapToDouble(r -> ((Number) r.get("RevenueAmount")).doubleValue())
                    .sum();
            double totalMemberships = memberships.stream()
                    .mapToDouble(r -> ((Number) r.get("RevenueAmount")).doubleValue()).sum();

            PdfPTable summaryTable = new PdfPTable(2);
            summaryTable.setWidthPercentage(100);
            summaryTable.setSpacingBefore(10f);
            summaryTable.setSpacingAfter(30f);

            addCellWithStyle(summaryTable, "Total Product Revenue", Element.ALIGN_LEFT, normalFont);
            addCellWithStyle(summaryTable, String.format("%,.0f VND", totalProducts), Element.ALIGN_RIGHT, normalFont);
            addCellWithStyle(summaryTable, "Total Membership Revenue", Element.ALIGN_LEFT, normalFont);
            addCellWithStyle(summaryTable, String.format("%,.0f VND", totalMemberships), Element.ALIGN_RIGHT,
                    normalFont);
            addCellWithStyle(summaryTable, "Net Total Revenue", Element.ALIGN_LEFT, subTitleFont);
            addCellWithStyle(summaryTable, String.format("%,.0f VND", totalProducts + totalMemberships),
                    Element.ALIGN_RIGHT, subTitleFont);

            document.add(summaryTable);

            // Products Table
            document.add(new Paragraph("Product Orders Detail", subTitleFont));
            PdfPTable pTable = new PdfPTable(3);
            pTable.setWidthPercentage(100);
            pTable.setSpacingBefore(10f);
            pTable.setSpacingAfter(30f);

            addHeaderCell(pTable, "Date", headerFont);
            addHeaderCell(pTable, "Paid Orders", headerFont);
            addHeaderCell(pTable, "Revenue Amount", headerFont);

            for (Map<String, Object> row : products) {
                addCell(pTable, row.get("RevenueDate").toString(), normalFont);
                addCell(pTable, row.get("PaidOrders").toString(), normalFont);
                addCell(pTable, String.format("%,.0f VND", ((Number) row.get("RevenueAmount")).doubleValue()),
                        normalFont);
            }
            document.add(pTable);

            // Memberships Table
            document.add(new Paragraph("Membership Subscriptions Detail", subTitleFont));
            PdfPTable mTable = new PdfPTable(3);
            mTable.setWidthPercentage(100);
            mTable.setSpacingBefore(10f);

            addHeaderCell(mTable, "Date", headerFont);
            addHeaderCell(mTable, "Paid Memberships", headerFont);
            addHeaderCell(mTable, "Revenue Amount", headerFont);

            for (Map<String, Object> row : memberships) {
                addCell(mTable, row.get("RevenueDate").toString(), normalFont);
                addCell(mTable, row.get("PaidMemberships").toString(), normalFont);
                addCell(mTable, String.format("%,.0f VND", ((Number) row.get("RevenueAmount")).doubleValue()),
                        normalFont);
            }
            document.add(mTable);

            document.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        return out.toByteArray();
    }

    private void addHeaderCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(new java.awt.Color(13, 148, 136)); // teal-600
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setPadding(8);
        table.addCell(cell);
    }

    private void addCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void addCellWithStyle(PdfPTable table, String text, int align, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(align);
        cell.setBorder(0);
        cell.setPadding(5);
        table.addCell(cell);
    }
}
