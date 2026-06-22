package com.hms.repository;

import com.hms.domain.EventBookingStatus;
import com.hms.entity.EventBooking;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventBookingRepository extends JpaRepository<EventBooking, UUID> {

    List<EventBooking> findByHotel_IdAndGroupBooking_IdOrderByStartDatetimeAsc(UUID hotelId, UUID groupId);

    Optional<EventBooking> findByIdAndHotel_IdAndGroupBooking_Id(UUID id, UUID hotelId, UUID groupId);

    List<EventBooking> findByHotel_IdAndStartDatetimeGreaterThanEqualAndStatusNotOrderByStartDatetimeAsc(
            UUID hotelId, LocalDateTime from, EventBookingStatus status);

    @Query(
            """
            select count(e) from EventBooking e
            where e.hotel.id = :hotelId
              and e.venueOrFacilityId = :venueOrFacilityId
              and e.status <> :cancelled
              and (:excludeEventId is null or e.id <> :excludeEventId)
              and e.startDatetime < :endDatetime
              and e.endDatetime > :startDatetime
            """)
    long countVenueConflicts(
            @Param("hotelId") UUID hotelId,
            @Param("venueOrFacilityId") UUID venueOrFacilityId,
            @Param("startDatetime") LocalDateTime startDatetime,
            @Param("endDatetime") LocalDateTime endDatetime,
            @Param("cancelled") EventBookingStatus cancelled,
            @Param("excludeEventId") UUID excludeEventId);
}
