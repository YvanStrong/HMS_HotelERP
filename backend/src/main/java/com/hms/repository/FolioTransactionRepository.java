package com.hms.repository;

import com.hms.entity.FolioTransaction;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FolioTransactionRepository extends JpaRepository<FolioTransaction, UUID> {

    List<FolioTransaction> findByGuestFolio_IdOrderByCreatedAtDesc(UUID folioId);

    boolean existsByRoomCharge_Id(UUID roomChargeId);

    boolean existsByPayment_Id(UUID paymentId);
}
