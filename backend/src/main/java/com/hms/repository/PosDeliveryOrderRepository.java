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
            left join fetch o.staffUser
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
            join fetch o.hotel h
            left join fetch o.lines l
            left join fetch l.product p
            left join fetch o.promotion
            left join fetch o.staffUser
            where o.hotel.id = :hotelId and o.id in :ids
            """)
    List<PosDeliveryOrder> findFetchedByIdsAndHotelId(
            @Param("hotelId") UUID hotelId, @Param("ids") List<UUID> ids);

    @Query(
            """
            select distinct o from PosDeliveryOrder o
            join fetch o.depot d
            left join fetch o.lines l
            left join fetch l.product p
            left join fetch o.staffUser
            where o.id = :orderId and o.hotel.id = :hotelId
            """)
    Optional<PosDeliveryOrder> findFetchedByIdAndHotelId(
            @Param("orderId") UUID orderId, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select distinct o from PosDeliveryOrder o
            join fetch o.depot d
            left join fetch o.lines l
            left join fetch l.product p
            left join fetch o.promotion
            where o.hotel.id = :hotelId
              and o.depot.id = :depotId
              and o.status = 'PENDING'
              and lower(trim(o.locationLabel)) = lower(trim(:locationLabel))
            order by o.createdAt asc
            """)
    List<PosDeliveryOrder> findPendingFetchedByHotelDepotAndLocation(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("locationLabel") String locationLabel);

    @Query(
            """
            select o from PosDeliveryOrder o
            join fetch o.depot d
            left join fetch o.staffUser
            where o.hotel.id = :hotelId
              and o.status = 'PENDING'
              and o.locationLabel is not null
            order by o.createdAt desc
            """)
    List<PosDeliveryOrder> findPendingForTables(@Param("hotelId") UUID hotelId);

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
