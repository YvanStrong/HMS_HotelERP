package com.hms.repository;

import com.hms.entity.PlatformAuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformAuditLogRepository extends JpaRepository<PlatformAuditLog, UUID> {

    List<PlatformAuditLog> findTop200ByOrderByTimestampDesc();

    List<PlatformAuditLog> findTop200ByTargetTenantIdOrderByTimestampDesc(UUID targetTenantId);
}
