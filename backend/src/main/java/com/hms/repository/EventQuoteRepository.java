package com.hms.repository;

import com.hms.entity.EventQuote;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventQuoteRepository extends JpaRepository<EventQuote, UUID> {

    Optional<EventQuote> findByEventBooking_Id(UUID eventId);

    Optional<EventQuote> findByIdAndHotel_IdAndGroupBooking_Id(UUID id, UUID hotelId, UUID groupId);

    @Query(
            """
            select q from EventQuote q
            join fetch q.eventBooking e
            where q.groupBooking.id = :groupId and q.hotel.id = :hotelId
            order by e.startDatetime asc
            """)
    List<EventQuote> findByGroupWithEvent(@Param("hotelId") UUID hotelId, @Param("groupId") UUID groupId);

    @Query(
            """
            select q from EventQuote q
            join fetch q.eventBooking e
            join fetch q.groupBooking g
            where q.hotel.id = :hotelId and e.startDatetime >= :from
            order by e.startDatetime asc
            """)
    List<EventQuote> findUpcomingByHotel(@Param("hotelId") UUID hotelId, @Param("from") java.time.LocalDateTime from);
}
