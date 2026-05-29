package com.hms.repository;

import com.hms.entity.TenantSubscriptionAudit;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantSubscriptionAuditRepository extends JpaRepository<TenantSubscriptionAudit, UUID> {
    List<TenantSubscriptionAudit> findByHotelIdOrderByCreatedAtDesc(UUID hotelId);
}
