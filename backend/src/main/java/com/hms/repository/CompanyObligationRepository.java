package com.hms.repository;

import com.hms.entity.CompanyObligation;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyObligationRepository extends JpaRepository<CompanyObligation, UUID> {

    List<CompanyObligation> findByHotel_IdOrderByEntryDateDescCreatedAtDesc(UUID hotelId);

    Optional<CompanyObligation> findByIdAndHotel_Id(UUID id, UUID hotelId);

    List<CompanyObligation> findByHotel_IdAndReferenceNoAndKind(UUID hotelId, String referenceNo, String kind);
}
