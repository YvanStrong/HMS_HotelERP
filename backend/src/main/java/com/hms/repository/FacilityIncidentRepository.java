package com.hms.repository;

import com.hms.entity.FacilityIncident;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacilityIncidentRepository extends JpaRepository<FacilityIncident, UUID> {
    List<FacilityIncident> findByFacility_IdOrderByOccurredAtDesc(UUID facilityId);
    Optional<FacilityIncident> findByIdAndFacility_Hotel_Id(UUID id, UUID hotelId);
}
