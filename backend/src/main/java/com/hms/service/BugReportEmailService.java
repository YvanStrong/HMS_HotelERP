package com.hms.service;

import com.hms.entity.BugReport;
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
public class BugReportEmailService {

    private final JavaMailSender mailSender;

    @Value("${hms.notifications.email.enabled:true}")
    private boolean enabled;

    @Value("${hms.notifications.email.from:}")
    private String fromAddress;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${hms.support.email:}")
    private String supportEmail;

    public boolean isConfigured() {
        return enabled
                && mailUsername != null
                && !mailUsername.isBlank()
                && resolveSupportInbox() != null;
    }

    public String resolveSupportInbox() {
        if (supportEmail != null && !supportEmail.isBlank()) {
            return supportEmail.trim();
        }
        if (fromAddress != null && !fromAddress.isBlank()) {
            return fromAddress.trim();
        }
        if (mailUsername != null && !mailUsername.isBlank()) {
            return mailUsername.trim();
        }
        return null;
    }

    public void sendBugReport(BugReport report) throws MessagingException {
        if (!isConfigured()) {
            throw new IllegalStateException("Outbound email is not configured for bug reports");
        }
        String to = resolveSupportInbox();
        String from = fromAddress != null && !fromAddress.isBlank() ? fromAddress : mailUsername;
        String subject = "[Bug " + report.getSeverity() + "] " + report.getTitle();

        var message = mailSender.createMimeMessage();
        var helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(from);
        helper.setTo(to);
        if (report.getReporterEmail() != null && !report.getReporterEmail().isBlank()) {
            helper.setReplyTo(report.getReporterEmail().trim());
        }
        helper.setSubject(subject);
        helper.setText(buildPlain(report), buildHtml(report));
        mailSender.send(message);
        log.info("Bug report email sent for id={} to={}", report.getId(), mask(to));
    }

    private static String buildPlain(BugReport r) {
        return """
                New bug report

                ID: %s
                Severity: %s
                Title: %s

                Reporter: %s (%s)
                Role: %s
                Hotel ID: %s
                Page: %s

                Description:
                %s

                — HMS Platform
                """
                .formatted(
                        r.getId(),
                        r.getSeverity(),
                        r.getTitle(),
                        nullToDash(r.getReporterUsername()),
                        nullToDash(r.getReporterEmail()),
                        nullToDash(r.getReporterRole()),
                        r.getHotelId() == null ? "—" : r.getHotelId().toString(),
                        nullToDash(r.getPageUrl()),
                        r.getDescription());
    }

    private static String buildHtml(BugReport r) {
        return """
                <!doctype html>
                <html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f8fafc;padding:24px;">
                  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;">Bug report</p>
                    <h1 style="margin:0 0 16px;font-size:22px;">%s</h1>
                    <p style="margin:0 0 12px;"><strong>Severity:</strong> %s &nbsp;·&nbsp; <strong>ID:</strong> %s</p>
                    <table style="width:100%%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">
                      <tr><td style="padding:6px 0;color:#64748b;width:120px;">Reporter</td><td>%s (%s)</td></tr>
                      <tr><td style="padding:6px 0;color:#64748b;">Role</td><td>%s</td></tr>
                      <tr><td style="padding:6px 0;color:#64748b;">Hotel</td><td>%s</td></tr>
                      <tr><td style="padding:6px 0;color:#64748b;">Page</td><td style="word-break:break-all;">%s</td></tr>
                    </table>
                    <div style="background:#f1f5f9;border-radius:12px;padding:16px;white-space:pre-wrap;line-height:1.5;">%s</div>
                  </div>
                </body></html>
                """
                .formatted(
                        esc(r.getTitle()),
                        esc(String.valueOf(r.getSeverity())),
                        esc(String.valueOf(r.getId())),
                        esc(nullToDash(r.getReporterUsername())),
                        esc(nullToDash(r.getReporterEmail())),
                        esc(nullToDash(r.getReporterRole())),
                        esc(r.getHotelId() == null ? "—" : r.getHotelId().toString()),
                        esc(nullToDash(r.getPageUrl())),
                        esc(r.getDescription()));
    }

    private static String nullToDash(String v) {
        return v == null || v.isBlank() ? "—" : v;
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

    private static String mask(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
