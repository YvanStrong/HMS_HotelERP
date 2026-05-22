package com.hms.scheduler;

import com.hms.domain.ReservationStatus;
import com.hms.entity.Hotel;
import com.hms.entity.Reservation;
import com.hms.repository.ReservationRepository;
import com.hms.service.OverstayChargeService;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OverstayAutoPostJob {

    private static final Logger log = LoggerFactory.getLogger(OverstayAutoPostJob.class);

    private final ReservationRepository reservationRepository;
    private final OverstayChargeService overstayChargeService;

    public OverstayAutoPostJob(
            ReservationRepository reservationRepository, OverstayChargeService overstayChargeService) {
        this.reservationRepository = reservationRepository;
        this.overstayChargeService = overstayChargeService;
    }

    @Scheduled(fixedDelayString = "${hms.overstay.auto-post-poll-ms:1800000}")
    public void autoPostOverstayCharges() {
        List<Reservation> stays = reservationRepository.findByStatusForOverstayScan(ReservationStatus.CHECKED_IN);
        Instant now = Instant.now();
        for (Reservation stay : stays) {
            Hotel hotel = stay.getHotel();
            if (hotel == null
                    || !hotel.isOverstayAutoPostEnabled()
                    || !"SCHEDULED_AUTO".equalsIgnoreCase(hotel.getOverstayPostTiming())) {
                continue;
            }
            try {
                overstayChargeService.ensurePosted(stay, now, "Auto overstay job");
            } catch (Exception ex) {
                log.warn("Could not auto-post overstay charge for reservation {}: {}", stay.getId(), ex.getMessage());
            }
        }
    }
}
