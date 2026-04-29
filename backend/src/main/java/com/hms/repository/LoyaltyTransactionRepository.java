package com.hms.repository;

import com.hms.entity.LoyaltyTransaction;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, UUID> {

    List<LoyaltyTransaction> findByGuest_IdOrderByTransactionDateDesc(UUID guestId);
}
