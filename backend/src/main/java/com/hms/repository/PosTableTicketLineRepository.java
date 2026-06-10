package com.hms.repository;

import com.hms.domain.PosTicketLineStatus;
import com.hms.entity.PosTableTicketLine;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosTableTicketLineRepository extends JpaRepository<PosTableTicketLine, UUID> {

    List<PosTableTicketLine> findByTicket_IdOrderByRoundAscLineOrderAsc(UUID ticketId);

    @Query(
            """
            select l from PosTableTicketLine l
            join fetch l.ticket t
            join fetch l.product
            where l.id = :lineId and t.hotel.id = :hotelId
            """)
    Optional<PosTableTicketLine> findFetchedByIdAndHotelId(
            @Param("lineId") UUID lineId, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select coalesce(max(l.round), 0) from PosTableTicketLine l
            where l.ticket.id = :ticketId
            """)
    int maxRoundForTicket(@Param("ticketId") UUID ticketId);

    @Query(
            """
            select l from PosTableTicketLine l
            join fetch l.ticket t
            join fetch l.product
            join fetch t.depot
            left join fetch t.staffUser
            where t.depot.id = :depotId
              and t.hotel.id = :hotelId
              and t.status in ('OPEN', 'SENT_TO_KITCHEN', 'SERVED')
              and l.lineStatus in :statuses
            order by t.updatedAt asc, l.round asc, l.lineOrder asc
            """)
    List<PosTableTicketLine> findKitchenLines(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("statuses") List<PosTicketLineStatus> statuses);

    @Query(
            """
            select l from PosTableTicketLine l
            join fetch l.ticket t
            join fetch l.product
            join fetch t.depot
            left join fetch t.staffUser
            where t.hotel.id = :hotelId
              and (:depotId is null or t.depot.id = :depotId)
              and t.status in ('OPEN', 'SENT_TO_KITCHEN', 'SERVED')
              and l.lineStatus in :statuses
            order by t.updatedAt asc, l.round asc, l.lineOrder asc
            """)
    List<PosTableTicketLine> findKitchenLinesForHotel(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("statuses") List<PosTicketLineStatus> statuses);
}
