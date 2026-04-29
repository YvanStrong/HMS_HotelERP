package com.hms.repository;

import com.hms.entity.RoomTypeNightlyRate;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomTypeNightlyRateRepository extends JpaRepository<RoomTypeNightlyRate, UUID> {

    List<RoomTypeNightlyRate> findByRoomType_IdAndRateDateBetweenOrderByRateDateAsc(
            UUID roomTypeId, LocalDate fromInclusive, LocalDate toInclusive);

    Optional<RoomTypeNightlyRate> findByRoomType_IdAndRateDate(UUID roomTypeId, LocalDate rateDate);

    void deleteByRoomType_IdAndRateDateBetween(UUID roomTypeId, LocalDate fromInclusive, LocalDate toInclusive);
}
