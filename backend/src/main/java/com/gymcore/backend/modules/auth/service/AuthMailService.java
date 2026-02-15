package com.gymcore.backend.modules.auth.service;

import jakarta.mail.internet.MimeMessage;
import java.time.Duration;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class AuthMailService {

    private static final Logger log = LoggerFactory.getLogger(AuthMailService.class);
    private static final String UTF_8 = "UTF-8";

    private final JavaMailSender mailSender;

    @Value("${spring.mail.from:no-reply@gymcore.local}")
    private String fromAddress;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    public AuthMailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendRegisterOtp(String to, String fullName, String otp, long expiresInSeconds) {
        String safeName = getSafeName(fullName);
        String subject = "GymCore - Verify your email";
        String expiryText = formatExpiry(expiresInSeconds);

        String plain = """
                Hi %s,

                Your GymCore verification code is: %s

                This code expires in %s.

                If you did not request this, you can ignore this email.
                """.formatted(safeName, otp, expiryText);

        String html = """
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
                  <h2 style="margin:0 0 8px 0;">Verify your email</h2>
                  <p style="margin:0 0 16px 0;">Hi %s,</p>
                  <p style="margin:0 0 12px 0;">Use this code to verify your GymCore account:</p>
                  <div style="display:inline-block; background:#f1f5f9; border:1px solid #e2e8f0; padding:14px 18px; border-radius:12px;">
                    <span style="font-size:24px; letter-spacing:6px; font-weight:700; color:#0f172a;">%s</span>
                  </div>
                  <p style="margin:16px 0 0 0; color:#334155;">This code expires in <strong>%s</strong>.</p>
                  <p style="margin:12px 0 0 0; color:#475569; font-size:13px;">
                    If you did not request this, you can safely ignore this email.
                  </p>
                  <hr style="border:none; border-top:1px solid #e2e8f0; margin:18px 0;" />
                  <p style="margin:0; color:#64748b; font-size:12px;">GymCore</p>
                </div>
                """.formatted(escapeHtml(safeName), escapeHtml(otp), escapeHtml(expiryText));

        sendHtml(to, subject, plain, html);
    }

    public void sendPasswordResetOtp(String to, String fullName, String otp, long expiresInSeconds) {
        String safeName = getSafeName(fullName);
        String subject = "GymCore - Password reset code";
        String expiryText = formatExpiry(expiresInSeconds);

        String plain = """
                Hi %s,

                Your GymCore password reset code is: %s

                This code expires in %s.

                If you did not request this, you can ignore this email.
                """.formatted(safeName, otp, expiryText);

        String html = """
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
                  <h2 style="margin:0 0 8px 0;">Reset your password</h2>
                  <p style="margin:0 0 16px 0;">Hi %s,</p>
                  <p style="margin:0 0 12px 0;">Use this code to reset your GymCore password:</p>
                  <div style="display:inline-block; background:#f1f5f9; border:1px solid #e2e8f0; padding:14px 18px; border-radius:12px;">
                    <span style="font-size:24px; letter-spacing:6px; font-weight:700; color:#0f172a;">%s</span>
                  </div>
                  <p style="margin:16px 0 0 0; color:#334155;">This code expires in <strong>%s</strong>.</p>
                  <p style="margin:12px 0 0 0; color:#475569; font-size:13px;">
                    If you did not request this, you can safely ignore this email.
                  </p>
                  <hr style="border:none; border-top:1px solid #e2e8f0; margin:18px 0;" />
                  <p style="margin:0; color:#64748b; font-size:12px;">GymCore</p>
                </div>
                """.formatted(escapeHtml(safeName), escapeHtml(otp), escapeHtml(expiryText));

        sendHtml(to, subject, plain, html);
    }

    public void sendWelcomeEmail(String to, String fullName) {
        String safeName = getSafeName(fullName);
        String subject = "Welcome to GymCore";
        String loginUrl = buildLoginUrl();

        String plain = """
                Hi %s,

                Your GymCore account has been verified successfully.
                You can now sign in and use all features.

                Sign in: %s

                Welcome to GymCore.
                """.formatted(safeName, loginUrl);

        String html = """
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
                  <h2 style="margin:0 0 8px 0;">Account verified</h2>
                  <p style="margin:0 0 16px 0;">Hi %s,</p>
                  <p style="margin:0 0 14px 0;">
                    Your GymCore account has been verified successfully. You can now sign in and use all features.
                  </p>
                  <p style="margin:0 0 18px 0;">
                    <a href="%s" style="display:inline-block; background:#16a34a; color:#ffffff; padding:10px 16px; border-radius:10px; text-decoration:none; font-weight:700;">
                      Sign in
                    </a>
                  </p>
                  <hr style="border:none; border-top:1px solid #e2e8f0; margin:18px 0;" />
                  <p style="margin:0; color:#64748b; font-size:12px;">GymCore</p>
                </div>
                """.formatted(escapeHtml(safeName), escapeHtml(loginUrl));

        sendHtml(to, subject, plain, html);
    }

    private String getSafeName(String fullName) {
        String trimmed = fullName == null ? "" : fullName.trim();
        return trimmed.isEmpty() ? "GymCore user" : trimmed;
    }

    private String buildLoginUrl() {
        String base = frontendBaseUrl == null ? "" : frontendBaseUrl.trim();
        if (base.isEmpty()) {
            base = "http://localhost:5173";
        }
        base = base.replaceAll("/+$", "");
        return base + "/auth/login";
    }

    private String formatExpiry(long expiresInSeconds) {
        long seconds = Math.max(0, expiresInSeconds);
        if (seconds < 60) {
            return seconds + " second(s)";
        }
        long minutes = (long) Math.ceil(seconds / 60.0);
        if (minutes < 60) {
            return minutes + " minute(s)";
        }
        Duration d = Duration.ofSeconds(seconds);
        long hours = d.toHours();
        long remMinutes = d.minusHours(hours).toMinutes();
        return String.format(Locale.ROOT, "%d hour(s) %d minute(s)", hours, remMinutes);
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

    private void sendHtml(String to, String subject, String plainText, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, UTF_8);
            String from = fromAddress == null ? "" : fromAddress.trim();
            if (from.isEmpty()) {
                from = "no-reply@gymcore.local";
            }
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(plainText, htmlBody);
            mailSender.send(message);
        } catch (Exception exception) {
            // Best-effort in local/dev. Do not break auth flows if mail fails.
            log.warn("Failed to send email to {}: {}", to, exception.getMessage());
        }
    }
}
