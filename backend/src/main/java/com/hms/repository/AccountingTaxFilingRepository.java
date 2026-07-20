package com.hms.repository;

import com.hms.entity.AccountingTaxFiling;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingTaxFilingRepository extends JpaRepository<AccountingTaxFiling, UUID> {
    List<AccountingTaxFiling> findByHotel_IdOrderByPeriodEndDescTaxTypeAsc(UUID hotelId);
}
