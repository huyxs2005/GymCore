package com.gymcore.backend.modules.admin.service;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
        Map<String, Object> report = getRevenueReport();
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        Document document = new Document(PageSize.A4);
        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Font styles
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, Color.DARK_GRAY);
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.GRAY);
            Font tableHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.WHITE);
            Font rowFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            // Title
            Paragraph title = new Paragraph("GYM CORE - REVENUE INTELLIGENCE", headerFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(10);
            document.add(title);

            Paragraph subtitle = new Paragraph("Generated At: " + report.get("generatedAt"), rowFont);
            subtitle.setAlignment(Element.ALIGN_CENTER);
            subtitle.setSpacingAfter(40);
            document.add(subtitle);

            // Product Revenue Section
            document.add(new Paragraph("Product Sales Revenue", subHeaderFont));
            document.add(new Paragraph(" ")); // Spacer

            PdfPTable productTable = new PdfPTable(3);
            productTable.setWidthPercentage(100f);
            productTable.setWidths(new float[] { 3, 4, 3 });

            addTableHeader(productTable, tableHeaderFont, "Date", "Revenue (VND)", "Orders");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("productOrders");
            for (Map<String, Object> row : products) {
                productTable.addCell(new Phrase(row.get("RevenueDate").toString(), rowFont));
                productTable.addCell(new Phrase(String.format("%,.0f", row.get("RevenueAmount")), rowFont));
                productTable.addCell(new Phrase(row.get("PaidOrders").toString(), rowFont));
            }
            document.add(productTable);

            document.add(new Paragraph(" ")); // Large Spacer
            document.add(new Paragraph(" "));

            // Membership Revenue Section
            document.add(new Paragraph("Membership Subscriptions Revenue", subHeaderFont));
            document.add(new Paragraph(" ")); // Spacer

            PdfPTable membershipTable = new PdfPTable(3);
            membershipTable.setWidthPercentage(100f);
            membershipTable.setWidths(new float[] { 3, 4, 3 });

            addTableHeader(membershipTable, tableHeaderFont, "Date", "Revenue (VND)", "Subscriptions");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> memberships = (List<Map<String, Object>>) report.get("memberships");
            for (Map<String, Object> row : memberships) {
                membershipTable.addCell(new Phrase(row.get("RevenueDate").toString(), rowFont));
                membershipTable.addCell(new Phrase(String.format("%,.0f", row.get("RevenueAmount")), rowFont));
                membershipTable.addCell(new Phrase(row.get("PaidMemberships").toString(), rowFont));
            }
            document.add(membershipTable);

        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to export revenue report PDF.", exception);
        } finally {
            if (document.isOpen()) {
                document.close();
            }
        }

        return out.toByteArray();
    }

    private void addTableHeader(PdfPTable table, Font font, String... headers) {
        for (String header : headers) {
            PdfPCell cell = new PdfPCell();
            cell.setBackgroundColor(new Color(63, 81, 181)); // indigo
            cell.setPadding(6);
            cell.setPhrase(new Phrase(header, font));
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            table.addCell(cell);
        }
    }
}
