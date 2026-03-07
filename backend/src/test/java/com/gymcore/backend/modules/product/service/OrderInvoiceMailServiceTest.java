package com.gymcore.backend.modules.product.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

class OrderInvoiceMailServiceTest {

    private JavaMailSender mailSender;
    private OrderInvoiceMailService service;

    @BeforeEach
    void setUp() {
        mailSender = Mockito.mock(JavaMailSender.class);
        service = new OrderInvoiceMailService(mailSender);
        ReflectionTestUtils.setField(service, "fromAddress", "no-reply@gymcore.local");
    }

    @Test
    void sendProductInvoice_shouldRenderProfessionalPickupReceipt() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.sendProductInvoice(new OrderInvoiceMailService.InvoiceMailModel(
                "INV-202603071410-900",
                17,
                900,
                "customer@gymcore.local",
                "Customer Minh",
                "0900000004",
                null,
                "PAYOS",
                new BigDecimal("4000"),
                new BigDecimal("400"),
                new BigDecimal("3600"),
                LocalDateTime.of(2026, 3, 7, 14, 10),
                List.of(new OrderInvoiceMailService.InvoiceLineItem(
                        "Whey Protein",
                        2,
                        new BigDecimal("2000"),
                        new BigDecimal("4000")))));

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());

        MimeMessage sent = captor.getValue();
        String html = extractHtml(sent);
        assertTrue(String.valueOf(sent.getSubject()).contains("Product Receipt - Order #17"));
        assertTrue(html.contains("Pickup Instructions"));
        assertTrue(html.contains("front desk"));
        assertTrue(html.contains("Order ID"));
        assertTrue(html.contains("17"));
        assertFalse(html.contains("Address:</strong>"));
    }

    private String extractHtml(MimeMessage message) throws Exception {
        return extractPart(message.getContent(), "text/html");
    }

    private String extractPart(Object content, String contentType) throws Exception {
        if (content == null) {
            return "";
        }
        if (content instanceof String stringContent) {
            return stringContent;
        }
        if (content instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart part = multipart.getBodyPart(i);
                if (String.valueOf(part.getContentType()).toLowerCase().contains(contentType)) {
                    return String.valueOf(part.getContent());
                }
                String nested = extractPart(part.getContent(), contentType);
                if (!nested.isBlank()) {
                    return nested;
                }
            }
        }
        return "";
    }
}
