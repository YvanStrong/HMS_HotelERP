package com.hms.repository;

import com.hms.entity.FacilitySlot;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacilitySlotRepository extends JpaRepository<FacilitySlot, UUID> {

    Optional<FacilitySlot> findByIdAndFacility_Id(UUID id, UUID facilityId);

    Optional<FacilitySlot> findByIdAndFacility_Hotel_Id(UUID id, UUID hotelId);
}
