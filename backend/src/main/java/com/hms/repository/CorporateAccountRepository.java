package com.hms.repository;

import com.hms.entity.CorporateAccount;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CorporateAccountRepository extends JpaRepository<CorporateAccount, UUID> {

    List<CorporateAccount> findByHotel_IdOrderByCompanyNameAsc(UUID hotelId);

    Optional<CorporateAccount> findByIdAndHotel_Id(UUID id, UUID hotelId);
}
