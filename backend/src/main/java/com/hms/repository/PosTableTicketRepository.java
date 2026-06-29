package com.hms.repository;

import com.hms.domain.PosTableTicketStatus;
import com.hms.entity.PosTableTicket;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosTableTicketRepository extends JpaRepository<PosTableTicket, UUID> {

    Optional<PosTableTicket> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @Query(
            """
            select t from PosTableTicket t
            left join fetch t.lines l
            left join fetch l.product
            where t.id = :id and t.hotel.id = :hotelId
            """)
    Optional<PosTableTicket> findFetchedByIdAndHotelId(@Param("id") UUID id, @Param("hotelId") UUID hotelId);

    List<PosTableTicket> findByHotel_IdAndDepot_IdAndStatusInOrderByUpdatedAtDesc(
            UUID hotelId, UUID depotId, List<PosTableTicketStatus> statuses);

    @Query(
            """
            select t from PosTableTicket t
            join fetch t.depot
            left join fetch t.staffUser
            where t.hotel.id = :hotelId and t.status in :statuses
            order by t.updatedAt desc
            """)
    List<PosTableTicket> findByHotel_IdAndStatusInOrderByUpdatedAtDesc(
            @Param("hotelId") UUID hotelId, @Param("statuses") List<PosTableTicketStatus> statuses);

    @Query(
            """
            select distinct t from PosTableTicket t
            left join fetch t.depot
            left join fetch t.staffUser
            left join fetch t.lines l
            left join fetch l.product
            where t.hotel.id = :hotelId
              and t.status = com.hms.domain.PosTableTicketStatus.CLOSED
              and t.closedAt >= :start
              and t.closedAt < :end
            """)
    List<PosTableTicket> findClosedBetween(
            @Param("hotelId") UUID hotelId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(
            """
            select distinct t from PosTableTicket t
            left join fetch t.lines l
            left join fetch l.product
            left join fetch t.depot
            where t.hotel.id = :hotelId and t.depot.id = :depotId and t.status in :statuses
            order by t.updatedAt desc
            """)
    List<PosTableTicket> findKitchenBoard(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("statuses") List<PosTableTicketStatus> statuses);

    Optional<PosTableTicket> findFirstByHotel_IdAndDepot_IdAndTableLabelAndStatusIn(
            UUID hotelId, UUID depotId, String tableLabel, List<PosTableTicketStatus> statuses);

    Optional<PosTableTicket> findFirstByHotel_IdAndTable_IdAndStatusIn(
            UUID hotelId, UUID tableId, List<PosTableTicketStatus> statuses);

    @Query(
            """
            select distinct t from PosTableTicket t
            left join fetch t.lines l
            left join fetch l.product
            left join fetch t.depot
            left join fetch t.staffUser
            where t.hotel.id = :hotelId
              and t.status in :statuses
              and t.updatedAt >= :since
            order by t.updatedAt desc
            """)
    List<PosTableTicket> findRecentKitchenTickets(
            @Param("hotelId") UUID hotelId,
            @Param("statuses") List<PosTableTicketStatus> statuses,
            @Param("since") Instant since);

    @Query(
            """
            select distinct t from PosTableTicket t
            left join fetch t.depot
            left join fetch t.lines l
            left join fetch l.product
            where t.shift.id = :shiftId
            """)
    List<PosTableTicket> findFetchedByShiftId(@Param("shiftId") UUID shiftId);

    List<PosTableTicket> findByShift_IdAndStatusIn(UUID shiftId, List<PosTableTicketStatus> statuses);

    long countByShift_IdAndStatusIn(UUID shiftId, List<PosTableTicketStatus> statuses);

    @Query(
            """
            select distinct t from PosTableTicket t
            left join fetch t.depot
            left join fetch t.lines l
            left join fetch l.product
            where t.hotel.id = :hotelId
              and t.staffUser.id = :waiterUserId
              and t.status = com.hms.domain.PosTableTicketStatus.CLOSED
              and t.shift is null
              and t.closedAt >= :openedAt
              and t.closedAt <= :until
            """)
    List<PosTableTicket> findOrphanClosedForWaiterSince(
            @Param("hotelId") UUID hotelId,
            @Param("waiterUserId") UUID waiterUserId,
            @Param("openedAt") Instant openedAt,
            @Param("until") Instant until);
}
