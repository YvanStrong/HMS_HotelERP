package com.hms.repository;

import com.hms.domain.ShiftStatus;
import com.hms.entity.PosShift;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosShiftRepository extends JpaRepository<PosShift, UUID> {

    Optional<PosShift> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @Query(
            """
            select s from PosShift s
            join fetch s.depot
            join fetch s.waiterUser
            join fetch s.hotel
            where s.id = :id and s.hotel.id = :hotelId
            """)
    Optional<PosShift> findFetchedByIdAndHotelId(@Param("id") UUID id, @Param("hotelId") UUID hotelId);

    Optional<PosShift> findByHotel_IdAndWaiterUser_IdAndDepot_IdAndStatus(
            UUID hotelId, UUID waiterUserId, UUID depotId, ShiftStatus status);

    @Query(
            """
            select s from PosShift s
            join fetch s.depot
            join fetch s.waiterUser
            where s.hotel.id = :hotelId and s.waiterUser.id = :waiterUserId and s.status = 'OPEN'
            """)
    Optional<PosShift> findOpenByHotelAndWaiter(
            @Param("hotelId") UUID hotelId, @Param("waiterUserId") UUID waiterUserId);

    @Query(
            """
            select s from PosShift s
            join fetch s.depot
            join fetch s.waiterUser
            where s.hotel.id = :hotelId and s.status = 'OPEN'
            order by s.openedAt desc
            """)
    List<PosShift> findOpenByHotel(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select s from PosShift s
            join fetch s.depot
            join fetch s.waiterUser
            where s.hotel.id = :hotelId and s.depot.id = :depotId and s.status = 'OPEN'
            order by s.openedAt desc
            """)
    List<PosShift> findOpenByHotelAndDepot(@Param("hotelId") UUID hotelId, @Param("depotId") UUID depotId);

    Page<PosShift> findByHotel_IdAndDepot_Id(UUID hotelId, UUID depotId, Pageable pageable);

    Page<PosShift> findByHotel_IdAndWaiterUser_Id(UUID hotelId, UUID waiterUserId, Pageable pageable);

    Page<PosShift> findByHotel_IdAndStatusAndOpenedAtBetween(
            UUID hotelId, ShiftStatus status, Instant from, Instant to, Pageable pageable);

    long countByHotel_IdAndDepot_IdAndStatus(UUID hotelId, UUID depotId, ShiftStatus status);

    long countByHotel_IdAndStatus(UUID hotelId, ShiftStatus status);

    @Query(
            """
            select s from PosShift s
            join fetch s.depot
            join fetch s.waiterUser
            where s.hotel.id = :hotelId
              and (:depotId is null or s.depot.id = :depotId)
              and (:waiterId is null or s.waiterUser.id = :waiterId)
              and (:status is null or s.status = :status)
              and s.openedAt >= :from and s.openedAt < :to
            """)
    Page<PosShift> searchHistory(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("waiterId") UUID waiterId,
            @Param("status") ShiftStatus status,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query(
            """
            select count(s) from PosShift s
            where s.hotel.id = :hotelId
              and s.status = 'CLOSED'
              and s.closedAt >= :start and s.closedAt < :end
              and (:depotId is null or s.depot.id = :depotId)
            """)
    long countClosedBetween(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("start") Instant start,
            @Param("end") Instant end);
}
