package com.gymcore.backend.modules.product.service;

import jakarta.mail.internet.MimeMessage;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class OrderInvoiceMailService {

    private static final String UTF_8 = "UTF-8";
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final JavaMailSender mailSender;

    @Value("${spring.mail.from:no-reply@gymcore.local}")
    private String fromAddress;

    public OrderInvoiceMailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendProductInvoice(InvoiceMailModel invoice) throws Exception {
        String subject = "GymCore Invoice " + invoice.invoiceCode();
        String plain = buildPlainText(invoice);
        String html = buildHtml(invoice);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, UTF_8);
        String from = fromAddress == null ? "" : fromAddress.trim();
        if (from.isEmpty()) {
            from = "no-reply@gymcore.local";
        }
        helper.setFrom(from);
        helper.setTo(invoice.recipientEmail());
        helper.setSubject(subject);
        helper.setText(plain, html);
        mailSender.send(message);
    }

    private String buildPlainText(InvoiceMailModel invoice) {
        StringBuilder items = new StringBuilder();
        for (InvoiceLineItem item : invoice.items()) {
            items.append("- ")
                    .append(item.productName())
                    .append(" | Qty: ")
                    .append(item.quantity())
                    .append(" | Unit: ")
                    .append(formatMoney(item.unitPrice()))
                    .append(" | Total: ")
                    .append(formatMoney(item.lineTotal()))
                    .append('\n');
        }

        return """
                GymCore Product Invoice

                Hello %s,

                Thank you for your purchase. Your payment has been confirmed successfully.

                Invoice Code: %s
                Order ID: %d
                Payment ID: %d
                Paid At: %s
                Payment Method: %s

                Shipping Information
                Name: %s
                Email: %s
                Phone: %s
                Address: %s

                Items
                %s

                Subtotal: %s
                Discount: %s
                Total Paid: %s

                This is an automated payment receipt from GymCore.
                """.formatted(
                safe(invoice.recipientName()),
                safe(invoice.invoiceCode()),
                invoice.orderId(),
                invoice.paymentId(),
                formatDateTime(invoice.paidAt()),
                safe(invoice.paymentMethod()),
                safe(invoice.recipientName()),
                safe(invoice.recipientEmail()),
                safe(invoice.shippingPhone()),
                safe(invoice.shippingAddress()),
                items,
                formatMoney(invoice.subtotal()),
                formatMoney(invoice.discountAmount()),
                formatMoney(invoice.totalAmount()));
    }

    private String buildHtml(InvoiceMailModel invoice) {
        StringBuilder rows = new StringBuilder();
        for (InvoiceLineItem item : invoice.items()) {
            rows.append("""
                    <tr>
                      <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a;">%s</td>
                      <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; text-align:center; color:#0f172a;">%d</td>
                      <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; text-align:right; color:#0f172a;">%s</td>
                      <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; text-align:right; color:#0f172a;">%s</td>
                    </tr>
                    """.formatted(
                    escapeHtml(item.productName()),
                    item.quantity(),
                    escapeHtml(formatMoney(item.unitPrice())),
                    escapeHtml(formatMoney(item.lineTotal()))));
        }

        return """
                <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial,sans-serif; color:#0f172a;">
                  <div style="max-width:820px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden; box-shadow:0 18px 40px rgba(15,23,42,0.08);">
                    <div style="padding:28px 32px; background:linear-gradient(135deg,#0f172a,#1e293b); color:#ffffff;">
                      <div style="font-size:12px; letter-spacing:1.6px; text-transform:uppercase; opacity:0.78;">GymCore</div>
                      <h1 style="margin:10px 0 6px 0; font-size:28px; line-height:1.2;">Product Purchase Invoice</h1>
                      <p style="margin:0; color:#cbd5e1; font-size:14px;">Payment received successfully. Thank you for shopping with GymCore.</p>
                    </div>

                    <div style="padding:28px 32px 8px 32px;">
                      <div style="display:flex; gap:16px; flex-wrap:wrap;">
                        <div style="flex:1 1 220px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:18px;">
                          <div style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1.2px;">Invoice Code</div>
                          <div style="margin-top:8px; font-size:24px; font-weight:700; color:#0f172a;">%s</div>
                          <div style="margin-top:10px; color:#475569; font-size:13px;">Paid at %s</div>
                        </div>
                        <div style="flex:1 1 220px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:18px;">
                          <div style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1.2px;">Order Summary</div>
                          <div style="margin-top:8px; color:#0f172a; font-size:14px;"><strong>Order ID:</strong> %d</div>
                          <div style="margin-top:6px; color:#0f172a; font-size:14px;"><strong>Payment ID:</strong> %d</div>
                          <div style="margin-top:6px; color:#0f172a; font-size:14px;"><strong>Method:</strong> %s</div>
                        </div>
                      </div>
                    </div>

                    <div style="padding:8px 32px 0 32px;">
                      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:18px 20px;">
                        <div style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:12px;">Billing & Shipping</div>
                        <div style="color:#0f172a; font-size:14px; line-height:1.8;">
                          <div><strong>Name:</strong> %s</div>
                          <div><strong>Email:</strong> %s</div>
                          <div><strong>Phone:</strong> %s</div>
                          <div><strong>Address:</strong> %s</div>
                        </div>
                      </div>
                    </div>

                    <div style="padding:24px 32px 0 32px;">
                      <table style="width:100%%; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:18px; overflow:hidden;">
                        <thead>
                          <tr style="background:#0f172a;">
                            <th style="padding:14px; text-align:left; color:#ffffff; font-size:13px; font-weight:700;">Product</th>
                            <th style="padding:14px; text-align:center; color:#ffffff; font-size:13px; font-weight:700;">Qty</th>
                            <th style="padding:14px; text-align:right; color:#ffffff; font-size:13px; font-weight:700;">Unit Price</th>
                            <th style="padding:14px; text-align:right; color:#ffffff; font-size:13px; font-weight:700;">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          %s
                        </tbody>
                      </table>
                    </div>

                    <div style="padding:24px 32px 20px 32px;">
                      <div style="margin-left:auto; max-width:320px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:18px 20px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px; color:#334155;">
                          <span>Subtotal</span><strong>%s</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px; color:#334155;">
                          <span>Discount</span><strong>%s</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid #cbd5e1; font-size:18px; color:#0f172a;">
                          <span>Total Paid</span><strong>%s</strong>
                        </div>
                      </div>
                    </div>

                    <div style="padding:20px 32px 28px 32px; border-top:1px solid #e2e8f0; color:#64748b; font-size:12px; line-height:1.7;">
                      <div>This is an automated payment receipt from GymCore.</div>
                      <div>Please keep this invoice code for support and order tracking.</div>
                    </div>
                  </div>
                </div>
                """.formatted(
                escapeHtml(invoice.invoiceCode()),
                escapeHtml(formatDateTime(invoice.paidAt())),
                invoice.orderId(),
                invoice.paymentId(),
                escapeHtml(safe(invoice.paymentMethod())),
                escapeHtml(safe(invoice.recipientName())),
                escapeHtml(safe(invoice.recipientEmail())),
                escapeHtml(safe(invoice.shippingPhone())),
                escapeHtml(safe(invoice.shippingAddress())),
                rows,
                escapeHtml(formatMoney(invoice.subtotal())),
                escapeHtml(formatMoney(invoice.discountAmount())),
                escapeHtml(formatMoney(invoice.totalAmount())));
    }

    private String formatMoney(BigDecimal amount) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.US);
        DecimalFormat format = new DecimalFormat("#,##0.##", symbols);
        BigDecimal safeAmount = amount == null ? BigDecimal.ZERO : amount;
        return format.format(safeAmount) + " VND";
    }

    private String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return DATE_TIME_FORMATTER.format(dateTime) + " (Asia/Saigon)";
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    public record InvoiceMailModel(
            String invoiceCode,
            int orderId,
            int paymentId,
            String recipientEmail,
            String recipientName,
            String shippingPhone,
            String shippingAddress,
            String paymentMethod,
            BigDecimal subtotal,
            BigDecimal discountAmount,
            BigDecimal totalAmount,
            LocalDateTime paidAt,
            List<InvoiceLineItem> items) {
    }

    public record InvoiceLineItem(
            String productName,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal) {
    }
}
