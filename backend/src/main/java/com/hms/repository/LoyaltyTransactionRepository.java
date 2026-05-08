package com.hms.repository;

import com.hms.domain.LoyaltyTxnStatus;
import com.hms.entity.LoyaltyTransaction;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, UUID> {

    List<LoyaltyTransaction> findByGuest_IdOrderByTransactionDateDesc(UUID guestId);

    /** Find posted transactions whose expiry has passed — for nightly expiry job. */
    List<LoyaltyTransaction> findByStatusAndExpiryDateBefore(LoyaltyTxnStatus status, Instant cutoff);

    /** Sum of all POSTED points for a guest (positive = earned, negative = redeemed). */
    @Query("SELECT COALESCE(SUM(t.points), 0) FROM LoyaltyTransaction t "
            + "WHERE t.guest.id = :guestId AND t.status = 'POSTED'")
    long sumPostedPointsByGuestId(UUID guestId);

    /** All distinct guest IDs that have transactions — for tier recalculation. */
    @Query("SELECT DISTINCT t.guest.id FROM LoyaltyTransaction t")
    List<UUID> findDistinctGuestIds();
}
