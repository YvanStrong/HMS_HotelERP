package com.hms.repository;

import com.hms.entity.AccountingReceivable;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingReceivableRepository extends JpaRepository<AccountingReceivable, UUID> {
    List<AccountingReceivable> findByHotel_IdOrderByDueDateAscIssueDateDesc(UUID hotelId);
}
