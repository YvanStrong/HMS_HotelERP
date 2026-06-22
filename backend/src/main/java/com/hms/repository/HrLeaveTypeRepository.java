package com.hms.repository;

import com.hms.entity.HrLeaveType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HrLeaveTypeRepository extends JpaRepository<HrLeaveType, UUID> {

    List<HrLeaveType> findByHotel_IdOrderByName(UUID hotelId);

    List<HrLeaveType> findByHotel_IdAndIsActiveTrueOrderByName(UUID hotelId);

    boolean existsByHotel_IdAndNameIgnoreCase(UUID hotelId, String name);
}
