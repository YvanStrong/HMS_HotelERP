package com.hms.repository;

import com.hms.entity.WaterQualityLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WaterQualityLogRepository extends JpaRepository<WaterQualityLog, UUID> {
    List<WaterQualityLog> findByFacility_IdOrderByLoggedAtDesc(UUID facilityId);
}
