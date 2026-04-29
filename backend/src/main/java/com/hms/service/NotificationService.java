package com.hms.service;

import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.Notification;
import com.hms.entity.Reservation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.hms.repository.NotificationRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void queueBookingConfirmationEmail(Reservation reservation) {
        try {
            Guest g = reservation.getGuest();
            Hotel h = reservation.getHotel();
            if (g.getEmail() == null || g.getEmail().isBlank()) {
                return;
            }
            Notification n = new Notification();
            n.setHotel(h);
            n.setType("BOOKING_CONFIRMATION");
            n.setChannel("EMAIL");
            n.setRecipientType("GUEST");
            n.setRecipientId(g.getId());
            n.setSubject("Booking confirmed — " + reservation.getBookingReference());
            n.setBody(
                    "Your reservation is confirmed. Reference: "
                            + reservation.getBookingReference()
                            + ". Check-in: "
                            + reservation.getCheckInDate());
            n.setStatus("PENDING");
            n.setScheduledFor(java.time.Instant.now());
            n.setReferenceType("RESERVATION");
            n.setReferenceId(reservation.getId());
            notificationRepository.save(n);
        } catch (RuntimeException e) {
            log.warn("Could not queue booking confirmation: {}", e.getMessage());
        }
    }

    @Transactional
    public void schedulePostStayEmail(Reservation reservation) {
        Guest g = reservation.getGuest();
        Hotel h = reservation.getHotel();
        Notification n = new Notification();
        n.setHotel(h);
        n.setType("POST_STAY_THANK_YOU");
        n.setChannel("EMAIL");
        n.setRecipientType("GUEST");
        n.setRecipientId(g.getId());
        n.setSubject("Thank you for staying with us");
        n.setBody("We hope you enjoyed your stay. Reservation " + reservation.getConfirmationCode());
        n.setStatus("PENDING");
        n.setScheduledFor(Instant.now().plusSeconds(7200));
        n.setReferenceType("RESERVATION");
        n.setReferenceId(reservation.getId());
        notificationRepository.save(n);
    }
}
