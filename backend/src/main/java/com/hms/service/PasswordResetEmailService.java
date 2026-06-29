package com.hms.service;

import jakarta.mail.MessagingException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetEmailService {

    private final JavaMailSender mailSender;

    @Value("${hms.notifications.email.enabled:true}")
    private boolean enabled;

    @Value("${hms.notifications.email.from:}")
    private String fromAddress;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    public boolean isConfigured() {
        return enabled && mailUsername != null && !mailUsername.isBlank();
    }

    public void sendResetEmail(String username, String toEmail, String resetUrl) throws MessagingException {
        if (!isConfigured()) {
            throw new IllegalStateException("Outbound email is not configured");
        }
        String to = toEmail == null ? "" : toEmail.trim();
        if (to.isBlank()) {
            throw new IllegalArgumentException("Recipient email is required");
        }

        String from = fromAddress != null && !fromAddress.isBlank() ? fromAddress : mailUsername;
        String subject = "Reset your HMS password";
        String html = buildHtmlBody(username, resetUrl);
        String plain = buildPlainBody(username, resetUrl);

        var message = mailSender.createMimeMessage();
        var helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(from);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(plain, html);
        mailSender.send(message);
        log.info("Password reset email sent to {}", maskEmail(to));
    }

    private static String buildPlainBody(String username, String resetUrl) {
        return """
                Hello %s,

                We received a request to reset your HMS password.

                Open this link to choose a new password (valid for 1 hour):
                %s

                If you did not request this, you can ignore this email.

                — HMS
                """
                .formatted(username, resetUrl);
    }

    private static String buildHtmlBody(String username, String resetUrl) {
        String safeUser = esc(username);
        String safeUrl = esc(resetUrl);
        return """
                <!doctype html>
                <html>
                <body style="margin:0;background:#f1f5f9;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
                  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #e2e8f0;">
                    <h1 style="margin:0 0 12px;font-size:22px;">Reset your password</h1>
                    <p style="margin:0 0 16px;line-height:1.6;">Hello <strong>%s</strong>,</p>
                    <p style="margin:0 0 20px;line-height:1.6;">We received a request to reset your HMS password. Use the button below to choose a new one. This link expires in 1 hour.</p>
                    <p style="margin:0 0 24px;">
                      <a href="%s" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;">Reset password</a>
                    </p>
                    <p style="margin:0 0 12px;line-height:1.6;font-size:13px;color:#64748b;">If the button does not work, copy and paste this URL into your browser:<br><span style="word-break:break-all;">%s</span></p>
                    <p style="margin:0;font-size:13px;color:#64748b;">If you did not request this, you can ignore this email.</p>
                  </div>
                </body>
                </html>
                """
                .formatted(safeUser, safeUrl, safeUrl);
    }

    private static String esc(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
