package com.hms.repository;

import com.hms.entity.EnergyReading;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EnergyReadingRepository extends JpaRepository<EnergyReading, UUID> {

    List<EnergyReading> findByHotel_IdAndRecordedAtBetweenOrderByRecordedAtDesc(
            UUID hotelId, Instant from, Instant to);

    @Query("SELECT e.readingType, SUM(e.value) FROM EnergyReading e "
            + "WHERE e.hotel.id = :hotelId AND e.recordedAt BETWEEN :from AND :to "
            + "GROUP BY e.readingType")
    List<Object[]> sumByTypeForPeriod(UUID hotelId, Instant from, Instant to);
}
