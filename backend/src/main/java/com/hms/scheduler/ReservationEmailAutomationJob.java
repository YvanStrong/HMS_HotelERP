package com.hms.scheduler;

import com.hms.domain.ReservationStatus;
import com.hms.entity.Reservation;
import com.hms.repository.NotificationRepository;
import com.hms.repository.ReservationRepository;
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
public class ReservationEmailAutomationJob {

    private final ReservationRepository reservationRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final TenantSubscriptionGuard tenantSubscriptionGuard;
    private final Clock clock;

    /** Transactional reservation emails do not require marketing consent. */
    @Scheduled(cron = "0 0 * * * *")
    public void queueReservationReminders() {
        LocalDate today = LocalDate.now(clock);
        int queued = 0;
        queued += queueArrivalReminder(today.plusDays(3), "CHECKIN_REMINDER_3_DAYS", "Your check-in is in 3 days");
        queued += queueArrivalReminder(today.plusDays(1), "CHECKIN_REMINDER_1_DAY", "Your check-in is tomorrow");
        queued += queueArrivalReminder(today, "CHECKIN_REMINDER_TODAY", "Your check-in is today");
        queued += queueArrivalReminder(today, "CHECKIN_REMINDER_HOURS", "Your check-in is approaching in hours");
        queued += queueDepartureReminder(today, "CHECKOUT_REMINDER_TODAY", "Checkout reminder for today");
        if (queued > 0) {
            log.info("Queued {} reservation reminder email(s)", queued);
        }
    }

    private int queueArrivalReminder(LocalDate checkInDate, String type, String subjectPrefix) {
        int queued = 0;
        for (Reservation r : reservationRepository.findReminderArrivals(checkInDate, ReservationStatus.CONFIRMED)) {
            if (alreadyQueuedToday(r, type)) {
                continue;
            }
            if (tenantSubscriptionGuard.subscriptionContext(r.getHotel().getId()).blocked()) {
                continue;
            }
            notificationService.queueReservationEmail(
                    r,
                    type,
                    subjectPrefix + " - " + r.getHotel().getName(),
                    arrivalBody(r, subjectPrefix),
                    Instant.now(clock));
            queued++;
        }
        return queued;
    }

    private int queueDepartureReminder(LocalDate checkOutDate, String type, String subjectPrefix) {
        int queued = 0;
        for (Reservation r : reservationRepository.findReminderDepartures(checkOutDate, ReservationStatus.CHECKED_IN)) {
            if (alreadyQueuedToday(r, type)) {
                continue;
            }
            if (tenantSubscriptionGuard.subscriptionContext(r.getHotel().getId()).blocked()) {
                continue;
            }
            notificationService.queueReservationEmail(
                    r,
                    type,
                    subjectPrefix + " - " + r.getHotel().getName(),
                    checkoutBody(r),
                    Instant.now(clock));
            queued++;
        }
        return queued;
    }

    private boolean alreadyQueuedToday(Reservation r, String type) {
        LocalDate today = LocalDate.now(clock);
        Instant start = today.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant end = today.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        return notificationRepository.existsByHotel_IdAndRecipientIdAndTypeAndReferenceTypeAndReferenceIdAndScheduledForBetween(
                r.getHotel().getId(), r.getGuest().getId(), type, "RESERVATION", r.getId(), start, end);
    }

    private static String arrivalBody(Reservation r, String title) {
        String room = r.getRoom() != null ? r.getRoom().getRoomNumber() : "assigned room";
        String type = r.getRoom() != null && r.getRoom().getRoomType() != null ? r.getRoom().getRoomType().getName() : "room";
        return NotificationService.brandedReservationEmail(
                r,
                "Arrival reminder",
                title + " at " + r.getHotel().getName(),
                "<p style=\"margin:0 0 12px;\">" + NotificationService.escapeHtml(title) + " at <strong>"
                        + NotificationService.escapeHtml(r.getHotel().getName()) + "</strong>.</p>"
                        + "<p style=\"margin:0 0 12px;\">Confirmation code: <strong>"
                        + NotificationService.escapeHtml(r.getConfirmationCode()) + "</strong></p>"
                        + "<p style=\"margin:0 0 12px;\">Room: <strong>"
                        + NotificationService.escapeHtml(room + " - " + type) + "</strong></p>"
                        + "<p style=\"margin:0;\">Please bring your ID document for check-in. We look forward to welcoming you.</p>");
    }

    private static String checkoutBody(Reservation r) {
        return NotificationService.brandedReservationEmail(
                r,
                "Checkout reminder",
                "Checkout reminder from " + r.getHotel().getName(),
                "<p style=\"margin:0 0 12px;\">This is a checkout reminder from <strong>"
                        + NotificationService.escapeHtml(r.getHotel().getName()) + "</strong>.</p>"
                        + "<p style=\"margin:0 0 12px;\">Checkout date: <strong>"
                        + NotificationService.escapeHtml(r.getCheckOutDate()) + "</strong></p>"
                        + "<p style=\"margin:0;\">Please contact the front desk if you need late checkout or assistance with your invoice.</p>");
    }
}
