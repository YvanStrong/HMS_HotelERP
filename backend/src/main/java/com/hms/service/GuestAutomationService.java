package com.hms.service;

import com.hms.domain.ReservationStatus;
import com.hms.entity.Guest;
import com.hms.entity.Reservation;
import com.hms.repository.ReservationRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Automates CRM workflows: pre-arrival personalization, post-stay engagement,
 * and re-engagement campaigns.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GuestAutomationService {

    private final ReservationRepository reservationRepository;
    private final NotificationService notificationService;

    /**
     * Daily at 9:00 AM: Send pre-arrival instructions and upsell offers
     * to guests checking in 2 days from now.
     */
    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void processPreArrivals() {
        LocalDate targetDate = LocalDate.now().plusDays(2);
        log.info("Processing pre-arrival automation for {}", targetDate);

        List<Reservation> upcoming = reservationRepository.findByCheckInDateAndStatus(
                targetDate, ReservationStatus.CONFIRMED);

        for (Reservation res : upcoming) {
            Guest guest = res.getGuest();
            if (guest.isEmailOptIn()) {
                String message = String.format(
                    "Hello %s! We are excited to welcome you to %s on %s. " +
                    "Pre-checkin now to save time: http://hms-portal.com/checkin/%s",
                    guest.getFirstName(), res.getHotel().getName(), res.getCheckInDate(), res.getConfirmationCode()
                );
                notificationService.sendNotification(res.getHotel(), guest.getId(), "PRE_ARRIVAL", message);
                log.info("Sent pre-arrival notification to guest {}", guest.getId());
            }
        }
    }

    /**
     * Daily at 11:00 AM: Send thank-you emails and feedback surveys
     * to guests who checked out yesterday.
     */
    @Scheduled(cron = "0 0 11 * * ?")
    @Transactional
    public void processPostStays() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("Processing post-stay engagement for {}", yesterday);

        List<Reservation> departures = reservationRepository.findByCheckOutDateAndStatus(
                yesterday, ReservationStatus.CHECKED_OUT);

        for (Reservation res : departures) {
            Guest guest = res.getGuest();
            if (guest.isEmailOptIn()) {
                String message = String.format(
                    "Thank you for staying at %s, %s! We hope you had a wonderful stay. " +
                    "Please share your feedback: http://hms-portal.com/feedback/%s",
                    res.getHotel().getName(), guest.getFirstName(), res.getId()
                );
                notificationService.sendNotification(res.getHotel(), guest.getId(), "POST_STAY", message);
                log.info("Sent post-stay notification to guest {}", guest.getId());
            }
        }
    }

    /**
     * Monthly on the 1st: Re-engage guests who haven't stayed in 6 months.
     */
    @Scheduled(cron = "0 0 10 1 * ?")
    @Transactional
    public void processReEngagement() {
        log.info("Processing monthly re-engagement campaign");
        // Logic to find 'dormant' guests and send personalized offers
    }
}
