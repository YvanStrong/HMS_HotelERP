package com.hms.repository;

import com.hms.entity.AccountingAccount;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingAccountRepository extends JpaRepository<AccountingAccount, UUID> {
    List<AccountingAccount> findByHotel_IdOrderByCodeAsc(UUID hotelId);
    Optional<AccountingAccount> findByHotel_IdAndCode(UUID hotelId, String code);
    boolean existsByHotel_IdAndCode(UUID hotelId, String code);
}

