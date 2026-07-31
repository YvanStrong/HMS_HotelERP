package com.hms.service;

import com.hms.entity.BugReport;
import jakarta.mail.MessagingException;
import jakarta.mail.util.ByteArrayDataSource;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

    private static final Pattern DATA_URL =
            Pattern.compile("^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", Pattern.DOTALL);

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
        attachScreenshot(helper, report);
        mailSender.send(message);
        log.info("Bug report email sent for id={} to={}", report.getId(), mask(to));
    }

    private static void attachScreenshot(MimeMessageHelper helper, BugReport report) throws MessagingException {
        String data = report.getScreenshotData();
        if (data == null || data.isBlank()) {
            return;
        }
        Matcher m = DATA_URL.matcher(data.trim());
        if (!m.matches()) {
            return;
        }
        String contentType = m.group(1);
        byte[] bytes = Base64.getDecoder().decode(m.group(2).replaceAll("\\s+", ""));
        String fileName = report.getScreenshotFileName() != null && !report.getScreenshotFileName().isBlank()
                ? report.getScreenshotFileName()
                : "bug-screenshot.png";
        helper.addAttachment(fileName, new ByteArrayDataSource(bytes, contentType));
    }

    private static String buildPlain(BugReport r) {
        String screenshotNote = r.getScreenshotData() != null && !r.getScreenshotData().isBlank()
                ? "Screenshot: attached (" + nullToDash(r.getScreenshotFileName()) + ")\n"
                : "Screenshot: none\n";
        return """
                New bug report

                ID: %s
                Severity: %s
                Title: %s

                Reporter: %s (%s)
                Role: %s
                Hotel ID: %s
                Page: %s
                %s
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
                        screenshotNote,
                        r.getDescription());
    }

    private static String buildHtml(BugReport r) {
        boolean hasShot = r.getScreenshotData() != null && !r.getScreenshotData().isBlank();
        String shotBlock = hasShot
                ? """
                  <p style="margin:16px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Screenshot</p>
                  <p style="margin:0 0 12px;font-size:13px;color:#475569;">Attached to this email (%s). Preview below when supported by your client.</p>
                  <img src="%s" alt="Bug screenshot" style="max-width:100%%;border-radius:12px;border:1px solid #e2e8f0;" />
                  """
                        .formatted(esc(nullToDash(r.getScreenshotFileName())), r.getScreenshotData())
                : "<p style=\"margin:16px 0 0;font-size:13px;color:#64748b;\">No screenshot attached.</p>";
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
                    %s
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
                        esc(r.getDescription()),
                        shotBlock);
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
