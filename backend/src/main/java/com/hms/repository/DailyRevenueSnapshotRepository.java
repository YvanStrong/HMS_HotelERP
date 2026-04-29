package com.hms.repository;

import com.hms.entity.DailyRevenueSnapshot;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyRevenueSnapshotRepository extends JpaRepository<DailyRevenueSnapshot, UUID> {

    long countByHotel_Id(UUID hotelId);

    Optional<DailyRevenueSnapshot> findByHotel_IdAndSummaryDate(UUID hotelId, LocalDate summaryDate);
}
