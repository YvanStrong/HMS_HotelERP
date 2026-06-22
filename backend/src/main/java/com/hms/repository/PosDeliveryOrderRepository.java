package com.hms.repository;

import com.hms.entity.PosDeliveryOrder;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosDeliveryOrderRepository extends JpaRepository<PosDeliveryOrder, UUID> {

    @Query("select count(o) from PosDeliveryOrder o where o.hotel.id = :hotelId")
    long countByHotelId(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select o from PosDeliveryOrder o
            join fetch o.depot d
            where o.hotel.id = :hotelId
              and (:status is null or o.status = :status)
            order by o.createdAt desc
            """)
    List<PosDeliveryOrder> findByHotelId(
            @Param("hotelId") UUID hotelId, @Param("status") String status);

    @Query(
            """
            select distinct o from PosDeliveryOrder o
            join fetch o.depot d
            left join fetch o.lines l
            left join fetch l.product p
            where o.id = :orderId and o.hotel.id = :hotelId
            """)
    Optional<PosDeliveryOrder> findFetchedByIdAndHotelId(
            @Param("orderId") UUID orderId, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select distinct o from PosDeliveryOrder o
            join fetch o.depot
            left join fetch o.staffUser
            left join fetch o.lines l
            left join fetch l.product
            where o.hotel.id = :hotelId
              and o.createdAt >= :since
              and (o.staffUser is not null or o.locationLabel is not null)
            order by o.createdAt desc
            """)
    List<PosDeliveryOrder> findRecentStaffDeliveries(
            @Param("hotelId") UUID hotelId, @Param("since") Instant since);
}
