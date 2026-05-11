package com.hms.service;

import com.hms.domain.LoyaltyTier;
import com.hms.domain.LoyaltyTxnStatus;
import com.hms.domain.LoyaltyTxnType;
import com.hms.entity.Guest;
import com.hms.entity.LoyaltyTransaction;
import com.hms.repository.GuestRepository;
import com.hms.repository.LoyaltyTransactionRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Scheduled jobs for loyalty program maintenance:
 * <ul>
 *   <li>Nightly tier recalculation based on lifetime points</li>
 *   <li>Nightly expiry of old posted points</li>
 * </ul>
 */
@Service
public class LoyaltyMaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(LoyaltyMaintenanceService.class);

    private final LoyaltyTransactionRepository txnRepo;
    private final GuestRepository guestRepo;

    public LoyaltyMaintenanceService(LoyaltyTransactionRepository txnRepo, GuestRepository guestRepo) {
        this.txnRepo = txnRepo;
        this.guestRepo = guestRepo;
    }

    /**
     * Nightly job: recalculate loyalty tier for all guests with transactions.
     * BRONZE < 1000, SILVER < 3000, GOLD < 5000, PLATINUM >= 5000
     */
    @Scheduled(cron = "0 30 2 * * ?") // 2:30 AM daily
    @Transactional
    public void recalculateTiers() {
        log.info("Loyalty tier recalculation started");
        List<UUID> guestIds = txnRepo.findDistinctGuestIds();
        int updated = 0;

        for (UUID guestId : guestIds) {
            long totalPoints = txnRepo.sumPostedPointsByGuestId(guestId);
            LoyaltyTier newTier = calculateTier(totalPoints);

            guestRepo.findById(guestId).ifPresent(guest -> {
                if (guest.getLoyaltyTier() != newTier) {
                    LoyaltyTier oldTier = guest.getLoyaltyTier();
                    guest.setLoyaltyTier(newTier);
                    guest.setLoyaltyPoints(totalPoints);
                    guestRepo.save(guest);
                    log.info("Guest {} tier changed: {} → {} (points={})", guestId, oldTier, newTier, totalPoints);
                } else {
                    // Just sync points count
                    guest.setLoyaltyPoints(totalPoints);
                    guestRepo.save(guest);
                }
            });
            updated++;
        }
        log.info("Loyalty tier recalculation complete: {} guests processed", updated);
    }

    /**
     * Nightly job: expire points past their expiry date.
     */
    @Scheduled(cron = "0 0 3 * * ?") // 3:00 AM daily
    @Transactional
    public void expirePoints() {
        log.info("Loyalty points expiry started");
        List<LoyaltyTransaction> expired = txnRepo.findByStatusAndExpiryDateBefore(
                LoyaltyTxnStatus.POSTED, Instant.now());

        int count = 0;
        for (LoyaltyTransaction txn : expired) {
            txn.setStatus(LoyaltyTxnStatus.EXPIRED);
            txnRepo.save(txn);

            // Create a balancing EXPIRED transaction
            LoyaltyTransaction expiryRecord = new LoyaltyTransaction();
            expiryRecord.setGuest(txn.getGuest());
            expiryRecord.setType(LoyaltyTxnType.EXPIRED);
            expiryRecord.setPoints(-txn.getPoints()); // Negative to zero out
            expiryRecord.setReference("expired:" + txn.getId());
            expiryRecord.setDescription("Points expired (original earned " + txn.getTransactionDate() + ")");
            expiryRecord.setStatus(LoyaltyTxnStatus.POSTED);
            txnRepo.save(expiryRecord);

            count++;
        }
        log.info("Loyalty points expiry complete: {} transactions expired", count);
    }

    private LoyaltyTier calculateTier(long points) {
        if (points >= 5000) return LoyaltyTier.PLATINUM;
        if (points >= 3000) return LoyaltyTier.GOLD;
        if (points >= 1000) return LoyaltyTier.SILVER;
        return LoyaltyTier.BRONZE;
    }
}
