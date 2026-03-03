package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mail.javamail.JavaMailSender;

class AuthMailServiceTest {

    private JavaMailSender mailSender;
    private AuthMailService authMailService;
    private MimeMessage mimeMessage;

    @BeforeEach
    void setUp() throws Exception {
        mailSender = Mockito.mock(JavaMailSender.class);
        authMailService = new AuthMailService(mailSender);
        setField(authMailService, "fromAddress", "no-reply@gymcore.local");
        setField(authMailService, "frontendBaseUrl", "http://localhost:5173");
        mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
    }

    @Test
    void sendRegisterOtp_shouldSendMultipartWithPlainAndHtmlContainingOtp() throws Exception {
        authMailService.sendRegisterOtp("to@gymcore.local", "Alex Carter", "123456", 120);

        verify(mailSender).send(any(MimeMessage.class));

        mimeMessage.saveChanges();

        List<String> plain = new ArrayList<>();
        List<String> html = new ArrayList<>();
        collectTextParts(mimeMessage, plain, html);

        String raw = rawMessage(mimeMessage);

        assertTrue(
                plain.stream().anyMatch(s -> s.contains("123456")),
                () -> "Expected OTP in text/plain part. Raw message:\n" + raw
        );
        assertTrue(
                html.stream().anyMatch(s -> s.contains("123456")),
                () -> "Expected OTP in text/html part. Raw message:\n" + raw
        );
        assertTrue(
                raw.toLowerCase().contains("text/html"),
                () -> "Expected message to include a text/html part. Raw message:\n" + raw
        );
        assertTrue(
                html.stream().anyMatch(s -> s.toLowerCase().contains("verify")),
                () -> "Expected HTML body to mention verification. Raw message:\n" + raw
        );
    }

    @Test
    void sendRegisterOtp_shouldEscapeHtmlInFullName() throws Exception {
        authMailService.sendRegisterOtp("to@gymcore.local", "<b>Huy</b>", "123456", 120);

        verify(mailSender).send(any(MimeMessage.class));

        mimeMessage.saveChanges();

        List<String> html = new ArrayList<>();
        collectTextParts(mimeMessage, new ArrayList<>(), html);

        assertTrue(html.stream().anyMatch(s -> s.contains("&lt;b&gt;Huy&lt;/b&gt;")));
        assertTrue(html.stream().noneMatch(s -> s.contains("<b>Huy</b>")));
    }

    private static void collectTextParts(Part part, List<String> plain, List<String> html) throws Exception {
        if (part.isMimeType("text/plain")) {
            plain.add(readTextPart(part));
            return;
        }
        if (part.isMimeType("text/html")) {
            html.add(readTextPart(part));
            return;
        }

        if (part.isMimeType("multipart/*")) {
            Object content = part.getContent();
            if (content instanceof Multipart mp) {
                for (int i = 0; i < mp.getCount(); i++) {
                    BodyPart bp = mp.getBodyPart(i);
                    collectTextParts(bp, plain, html);
                }
            }
            return;
        }

        Object content = part.getContent();
        if (content instanceof Multipart mp) {
            for (int i = 0; i < mp.getCount(); i++) {
                BodyPart bp = mp.getBodyPart(i);
                collectTextParts(bp, plain, html);
            }
        }
    }

    private static String readTextPart(Part part) throws Exception {
        Object content = part.getContent();
        if (content instanceof String s) {
            return s;
        }
        Charset charset = charsetFromContentType(part.getContentType());
        try (InputStream is = part.getInputStream()) {
            return new String(is.readAllBytes(), charset);
        }
    }

    private static String rawMessage(MimeMessage message) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        message.writeTo(baos);
        return baos.toString(StandardCharsets.UTF_8);
    }

    private static Charset charsetFromContentType(String contentType) {
        if (contentType == null) {
            return StandardCharsets.UTF_8;
        }
        String lower = contentType.toLowerCase();
        int idx = lower.indexOf("charset=");
        if (idx < 0) {
            return StandardCharsets.UTF_8;
        }
        String value = contentType.substring(idx + "charset=".length()).trim();
        if (value.startsWith("\"")) {
            int end = value.indexOf('"', 1);
            value = end > 1 ? value.substring(1, end) : value.substring(1);
        } else {
            int end = value.indexOf(';');
            if (end > 0) {
                value = value.substring(0, end).trim();
            }
        }
        try {
            return Charset.forName(value);
        } catch (Exception ignored) {
            return StandardCharsets.UTF_8;
        }
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
