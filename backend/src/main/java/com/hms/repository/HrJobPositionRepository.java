package com.hms.repository;

import com.hms.entity.HrJobPosition;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HrJobPositionRepository extends JpaRepository<HrJobPosition, UUID> {

    List<HrJobPosition> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    List<HrJobPosition> findByHotel_IdAndStatusOrderByCreatedAtDesc(UUID hotelId, String status);
}
