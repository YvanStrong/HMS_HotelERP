package com.hms.repository;

import com.hms.entity.SelfOrderEvent;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SelfOrderEventRepository extends JpaRepository<SelfOrderEvent, UUID> {

    @Query(
            """
            select count(e) from SelfOrderEvent e
            where e.hotel.id = :hotelId and e.createdAt >= :from and e.eventType = :eventType
            """)
    long countByHotelAndTypeSince(
            @Param("hotelId") UUID hotelId, @Param("from") Instant from, @Param("eventType") String eventType);

    @Query(
            """
            select count(e) from SelfOrderEvent e
            where e.hotel.id = :hotelId and e.createdAt >= :from
            """)
    long countAllSince(@Param("hotelId") UUID hotelId, @Param("from") Instant from);
}
