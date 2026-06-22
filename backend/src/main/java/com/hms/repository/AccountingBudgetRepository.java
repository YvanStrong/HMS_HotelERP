package com.hms.repository;

import com.hms.entity.AccountingBudget;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingBudgetRepository extends JpaRepository<AccountingBudget, UUID> {
    List<AccountingBudget> findByHotel_IdOrderByFiscalYearDescMonthAscAccountCodeAsc(UUID hotelId);
}
