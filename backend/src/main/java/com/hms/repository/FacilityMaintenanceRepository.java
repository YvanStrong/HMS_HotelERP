package com.hms.repository;

import com.hms.entity.FacilityMaintenance;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacilityMaintenanceRepository extends JpaRepository<FacilityMaintenance, UUID> {
    List<FacilityMaintenance> findByFacility_IdOrderByCreatedAtDesc(UUID facilityId);
}
