package com.hms.repository;

import com.hms.entity.PlatformUsageMetric;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformUsageMetricRepository extends JpaRepository<PlatformUsageMetric, UUID> {

    long countByTenantId(UUID tenantId);

    Optional<PlatformUsageMetric> findByTenantIdAndMetricDate(UUID tenantId, LocalDate metricDate);
}
