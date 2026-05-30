package com.hms.repository;

import com.hms.entity.HotelModuleAuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HotelModuleAuditLogRepository extends JpaRepository<HotelModuleAuditLog, UUID> {
    List<HotelModuleAuditLog> findByHotelIdOrderByChangedAtDesc(UUID hotelId);
}
