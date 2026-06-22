package com.hms.repository;

import com.hms.entity.AccountingReconciliation;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingReconciliationRepository extends JpaRepository<AccountingReconciliation, UUID> {
    List<AccountingReconciliation> findByHotel_IdOrderByStatementEndDescCreatedAtDesc(UUID hotelId);
}
