package com.hms.scheduler;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.Reservation;
import com.hms.repository.ReservationRepository;
import com.hms.service.OverstayChargeService;
import com.hms.service.TenantSubscriptionGuard;
import java.time.Clock;
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
    private final TenantSubscriptionGuard tenantSubscriptionGuard;
    private final Clock clock;

    public OverstayAutoPostJob(
            ReservationRepository reservationRepository,
            OverstayChargeService overstayChargeService,
            TenantSubscriptionGuard tenantSubscriptionGuard,
            Clock clock) {
        this.reservationRepository = reservationRepository;
        this.overstayChargeService = overstayChargeService;
        this.tenantSubscriptionGuard = tenantSubscriptionGuard;
        this.clock = clock;
    }

    @Scheduled(cron = "${hms.overstay.auto-post.cron:0 */30 * * * *}")
    public void postScheduledOverstayCharges() {
        Instant now = Instant.now(clock);
        List<Reservation> candidates = reservationRepository.findScheduledAutoPostOverstayCandidates();
        for (Reservation reservation : candidates) {
            try {
                if (tenantSubscriptionGuard.subscriptionContext(reservation.getHotel().getId()).blocked()) {
                    continue;
                }
                ApiDtos.OverstayStatusResponse status = overstayChargeService.preview(reservation, now);
                if (status.amountToPost().signum() > 0) {
                    overstayChargeService.postIfNeeded(reservation, now, "system");
                }
            } catch (RuntimeException e) {
                log.warn("Could not auto-post overstay fee for reservation {}", reservation.getId(), e);
            }
        }
    }
}
