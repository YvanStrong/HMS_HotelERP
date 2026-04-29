package com.hms.repository;

import com.hms.entity.FacilityMaintenance;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacilityMaintenanceRepository extends JpaRepository<FacilityMaintenance, UUID> {}
