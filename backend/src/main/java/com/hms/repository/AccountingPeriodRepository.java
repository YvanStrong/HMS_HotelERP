package com.hms.repository;

import com.hms.entity.AccountingPeriod;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingPeriodRepository extends JpaRepository<AccountingPeriod, UUID> {
    List<AccountingPeriod> findByHotel_IdOrderByStartDateDesc(UUID hotelId);

    Optional<AccountingPeriod> findFirstByHotel_IdAndStatusOrderByStartDateDesc(UUID hotelId, String status);
}
