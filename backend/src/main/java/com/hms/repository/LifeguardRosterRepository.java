package com.hms.repository;

import com.hms.entity.LifeguardRoster;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeguardRosterRepository extends JpaRepository<LifeguardRoster, UUID> {
    List<LifeguardRoster> findByFacility_IdAndShiftDateOrderByShiftStartAsc(UUID facilityId, LocalDate shiftDate);
    List<LifeguardRoster> findByFacility_IdOrderByShiftDateDescShiftStartAsc(UUID facilityId);
}
