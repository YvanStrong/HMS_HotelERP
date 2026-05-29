package com.hms.service;

import com.hms.entity.Notification;
import com.hms.repository.GuestRepository;
import com.hms.repository.NotificationRepository;
import java.time.Clock;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailNotificationDispatcher {

    private final NotificationRepository notificationRepository;
    private final GuestRepository guestRepository;
    private final JavaMailSender mailSender;
    private final TenantSubscriptionGuard tenantSubscriptionGuard;
    private final Clock clock;

    @Value("${hms.notifications.email.enabled:true}")
    private boolean enabled;

    @Value("${hms.notifications.email.from:}")
    private String fromAddress;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Scheduled(fixedDelayString = "${hms.notifications.email.dispatch-delay-ms:60000}")
    @Transactional
    public void sendPendingEmails() {
        if (!enabled || (mailUsername == null || mailUsername.isBlank())) {
            return;
        }
        var due = notificationRepository.findTop25ByChannelAndStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
                "EMAIL", "PENDING", Instant.now(clock));
        var missingAddressFailures =
                notificationRepository.findTop25ByChannelAndStatusAndRecipientAddressIsNullOrderByScheduledForAsc(
                        "EMAIL", "FAILED");
        for (Notification n : missingAddressFailures) {
            if (hydrateRecipientAddress(n)) {
                n.setStatus("PENDING");
                n.setScheduledFor(Instant.now(clock));
                notificationRepository.save(n);
            }
        }
        for (Notification n : due) {
            try {
                if (n.getHotel() != null && tenantSubscriptionGuard.subscriptionContext(n.getHotel().getId()).blocked()) {
                    continue;
                }
                sendNotificationEmail(n);
                n.setStatus("SENT");
                n.setSentAt(Instant.now(clock));
                notificationRepository.save(n);
            } catch (MessagingException | RuntimeException e) {
                n.setStatus("FAILED");
                notificationRepository.save(n);
                log.warn("Failed to send notification {}: {}", n.getId(), e.getMessage());
            }
        }
    }

    private void sendNotificationEmail(Notification n) throws MessagingException {
        String from = fromAddress != null && !fromAddress.isBlank() ? fromAddress : mailUsername;
        String to = resolveRecipientAddress(n);
        String body = n.getBody() != null ? n.getBody() : "";
        if (isHtml(body)) {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(n.getSubject());
            helper.setText(toPlainText(body), body);
            mailSender.send(message);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(n.getSubject());
        message.setText(body);
        mailSender.send(message);
    }

    private static boolean isHtml(String body) {
        String b = body.stripLeading().toLowerCase();
        return b.startsWith("<!doctype html") || b.startsWith("<html") || b.contains("<body");
    }

    private static String toPlainText(String html) {
        return html.replaceAll("(?is)<style.*?</style>", " ")
                .replaceAll("(?is)<script.*?</script>", " ")
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("(?i)</p>", "\n")
                .replaceAll("(?i)</div>", "\n")
                .replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replaceAll("[ \\t\\x0B\\f\\r]+", " ")
                .replaceAll("\\n\\s+", "\n")
                .trim();
    }

    private String resolveRecipientAddress(Notification n) {
        if (n.getRecipientAddress() != null && !n.getRecipientAddress().isBlank()) {
            return n.getRecipientAddress().trim();
        }
        if (hydrateRecipientAddress(n)) {
            return n.getRecipientAddress().trim();
        }
        throw new IllegalArgumentException("Notification recipient email address is missing");
    }

    private boolean hydrateRecipientAddress(Notification n) {
        if ("GUEST".equalsIgnoreCase(n.getRecipientType())) {
            String email = guestRepository
                    .findById(n.getRecipientId())
                    .map(g -> g.getEmail() != null ? g.getEmail().trim() : "")
                    .filter(address -> !address.isBlank())
                    .orElse(null);
            if (email != null) {
                n.setRecipientAddress(email);
                notificationRepository.save(n);
                return true;
            }
        }
        return false;
    }
}
