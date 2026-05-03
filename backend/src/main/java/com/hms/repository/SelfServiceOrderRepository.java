package com.hms.repository;

import com.hms.domain.SelfOrderPaymentStatus;
import com.hms.domain.SelfOrderStatus;
import com.hms.entity.SelfServiceOrder;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SelfServiceOrderRepository extends JpaRepository<SelfServiceOrder, UUID> {

    long countByHotel_Id(UUID hotelId);

    boolean existsByHotel_IdAndDisplayCodeIgnoreCase(UUID hotelId, String displayCode);

    Optional<SelfServiceOrder> findByTrackTokenAndHotel_Id(UUID trackToken, UUID hotelId);

    @Query(
            """
            select distinct o from SelfServiceOrder o
            join fetch o.depot d
            left join fetch o.lines l
            left join fetch l.product p
            where o.trackToken = :trackToken and o.hotel.id = :hotelId
            """)
    Optional<SelfServiceOrder> findFetchedByTrackTokenAndHotel_Id(
            @Param("trackToken") UUID trackToken, @Param("hotelId") UUID hotelId);

    Optional<SelfServiceOrder> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @Query(
            """
            select distinct o from SelfServiceOrder o
            join fetch o.depot d
            left join fetch o.lines l
            left join fetch l.product p
            where o.id = :id and o.hotel.id = :hotelId
            """)
    Optional<SelfServiceOrder> findFetchedByIdAndHotel_Id(@Param("id") UUID id, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select distinct o from SelfServiceOrder o
            join fetch o.depot d
            left join fetch o.lines l
            left join fetch l.product p
            where o.hotel.id = :hotelId and o.status in :statuses and o.paymentStatus = :paid
            order by o.createdAt asc
            """)
    List<SelfServiceOrder> findForBoard(
            @Param("hotelId") UUID hotelId,
            @Param("statuses") Collection<SelfOrderStatus> statuses,
            @Param("paid") SelfOrderPaymentStatus paid);

    @Query(
            """
            select distinct o from SelfServiceOrder o
            join fetch o.depot d
            left join fetch o.lines l
            left join fetch l.product p
            where o.hotel.id = :hotelId
            order by o.createdAt desc
            """)
    List<SelfServiceOrder> findRecentByHotel(@Param("hotelId") UUID hotelId, Pageable page);
}
