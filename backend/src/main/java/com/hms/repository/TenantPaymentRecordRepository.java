package com.hms.repository;

import com.hms.entity.TenantPaymentRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantPaymentRecordRepository extends JpaRepository<TenantPaymentRecord, UUID> {
    List<TenantPaymentRecord> findByHotelIdOrderByCreatedAtDesc(UUID hotelId);
}
