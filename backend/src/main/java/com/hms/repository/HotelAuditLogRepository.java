package com.hms.repository;

import com.hms.entity.HotelAuditLog;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HotelAuditLogRepository extends JpaRepository<HotelAuditLog, UUID> {

    Page<HotelAuditLog> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId, Pageable pageable);

    Page<HotelAuditLog> findByHotel_IdAndActionOrderByCreatedAtDesc(UUID hotelId, String action, Pageable pageable);

    Page<HotelAuditLog> findByHotel_IdAndCreatedAtBetweenOrderByCreatedAtDesc(
            UUID hotelId, Instant from, Instant to, Pageable pageable);
}
