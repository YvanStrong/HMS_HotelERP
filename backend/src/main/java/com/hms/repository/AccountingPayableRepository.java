package com.hms.repository;

import com.hms.entity.AccountingPayable;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingPayableRepository extends JpaRepository<AccountingPayable, UUID> {
    List<AccountingPayable> findByHotel_IdOrderByDueDateAscBillDateDesc(UUID hotelId);
}
