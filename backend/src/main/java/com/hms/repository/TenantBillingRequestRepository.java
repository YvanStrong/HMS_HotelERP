package com.hms.repository;

import com.hms.domain.TenantBillingRequestStatus;
import com.hms.entity.TenantBillingRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantBillingRequestRepository extends JpaRepository<TenantBillingRequest, UUID> {

    List<TenantBillingRequest> findByStatusOrderByRequestedAtDesc(TenantBillingRequestStatus status);

    List<TenantBillingRequest> findByHotelIdOrderByRequestedAtDesc(UUID hotelId);

    boolean existsByHotelIdAndStatus(UUID hotelId, TenantBillingRequestStatus status);
}
