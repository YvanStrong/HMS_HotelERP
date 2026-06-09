package com.hms.repository;

import com.hms.entity.BanquetEventOrder;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BanquetEventOrderRepository extends JpaRepository<BanquetEventOrder, UUID> {

    Optional<BanquetEventOrder> findByEventBooking_Id(UUID eventId);

    @Query(
            """
            select b from BanquetEventOrder b
            join fetch b.eventBooking e
            where b.id = :id and e.hotel.id = :hotelId
            """)
    Optional<BanquetEventOrder> findByIdAndHotel_Id(@Param("id") UUID id, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select b from BanquetEventOrder b
            join fetch b.eventBooking e
            where e.id = :eventId and e.hotel.id = :hotelId and e.groupBooking.id = :groupId
            """)
    Optional<BanquetEventOrder> findByEventAndScope(
            @Param("eventId") UUID eventId, @Param("hotelId") UUID hotelId, @Param("groupId") UUID groupId);
}
