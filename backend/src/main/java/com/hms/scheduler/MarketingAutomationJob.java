package com.hms.scheduler;

import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.repository.GuestRepository;
import com.hms.repository.NotificationRepository;
import com.hms.service.NotificationService;
import com.hms.service.TenantSubscriptionGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class MarketingAutomationJob {

    private static final String BIRTHDAY_TYPE = "BIRTHDAY_GREETING";

    private final GuestRepository guestRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final TenantSubscriptionGuard tenantSubscriptionGuard;
    private final Clock clock;

    /** Queue birthday greetings once per guest/day for guests who opted into marketing email. */
    @Scheduled(cron = "0 15 8 * * *")
    public void queueBirthdayGreetings() {
        LocalDate today = LocalDate.now(clock);
        Instant dayStart = today.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant dayEnd = today.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        int queued = 0;
        for (Guest guest : guestRepository.findMarketingEmailCandidates()) {
            if (!guest.isEmailOptIn() || guest.getDateOfBirth() == null) {
                continue;
            }
            LocalDate dob = guest.getDateOfBirth();
            if (dob.getMonthValue() != today.getMonthValue() || dob.getDayOfMonth() != today.getDayOfMonth()) {
                continue;
            }
            Hotel hotel = guest.getHotel();
            if (tenantSubscriptionGuard.subscriptionContext(hotel.getId()).blocked()) {
                continue;
            }
            if (notificationRepository.existsByHotel_IdAndRecipientIdAndTypeAndReferenceTypeAndReferenceIdAndScheduledForBetween(
                    hotel.getId(), guest.getId(), BIRTHDAY_TYPE, "GUEST", guest.getId(), dayStart, dayEnd)) {
                continue;
            }
            notificationService.queueMarketingEmail(
                    guest,
                    BIRTHDAY_TYPE,
                    "Happy birthday from " + hotel.getName(),
                    birthdayBody(guest),
                    Instant.now(clock));
            queued++;
        }
        if (queued > 0) {
            log.info("Queued {} birthday marketing email(s)", queued);
        }
    }

    private static String birthdayBody(Guest guest) {
        return NotificationService.brandedMarketingEmail(
                guest,
                "Birthday wishes",
                "Happy birthday from " + guest.getHotel().getName(),
                "<p style=\"margin:0 0 12px;\">Happy birthday from <strong>" + NotificationService.escapeHtml(guest.getHotel().getName()) + "</strong>!</p>"
                        + "<p style=\"margin:0 0 12px;\">Because you agreed to receive promotional offers, loyalty updates, and campaign messages, we wanted to celebrate your special day with warm wishes from our team.</p>"
                        + "<p style=\"margin:0;\">We hope to welcome you again soon.</p>");
    }
}
