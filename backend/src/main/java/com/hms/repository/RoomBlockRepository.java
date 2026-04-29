package com.hms.repository;

import com.hms.entity.RoomBlock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomBlockRepository extends JpaRepository<RoomBlock, UUID> {

    long countByHotel_Id(UUID hotelId);

    @Query(
            """
            select count(b) from RoomBlock b
            where b.room.id = :roomId
            and b.releasedAt is null
            and b.startDate < :stayEnd
            and b.endDate > :stayStart
            """)
    long countActiveOverlapping(
            @Param("roomId") UUID roomId,
            @Param("stayStart") LocalDate stayStart,
            @Param("stayEnd") LocalDate stayEnd);

    @Query(
            """
            select b from RoomBlock b join fetch b.room r
            where r.hotel.id = :hotelId
            and b.releasedAt is null
            and b.startDate < :rangeEnd
            and b.endDate > :rangeStart
            order by b.startDate, r.roomNumber
            """)
    List<RoomBlock> findActiveInRange(
            @Param("hotelId") UUID hotelId,
            @Param("rangeStart") LocalDate rangeStart,
            @Param("rangeEnd") LocalDate rangeEnd);

    long countByRoom_IdAndReleasedAtIsNull(UUID roomId);

    List<RoomBlock> findByRoom_IdAndReleasedAtIsNullOrderByCreatedAtDesc(UUID roomId);

    @Query(
            """
            select b.room.id from RoomBlock b join b.room r
            where r.hotel.id = :hotelId
            and b.releasedAt is null
            and b.startDate < :dayEnd
            and b.endDate > :dayStart
            """)
    List<UUID> findRoomIdsBlockedOnNight(
            @Param("hotelId") UUID hotelId,
            @Param("dayStart") LocalDate dayStart,
            @Param("dayEnd") LocalDate dayEnd);

    @Query(
            """
            select b from RoomBlock b
            where b.room.id = :roomId
            and b.releasedAt is null
            and b.startDate < :dayEnd
            and b.endDate > :dayStart
            order by b.startDate desc
            """)
    List<RoomBlock> findActiveOnNight(
            @Param("roomId") UUID roomId,
            @Param("dayStart") LocalDate dayStart,
            @Param("dayEnd") LocalDate dayEnd);

    @Query(
            """
            select b.id from RoomBlock b
            where b.autoRelease = true
            and b.blockedUntilInstant is not null
            and b.blockedUntilInstant < :now
            and b.releasedAt is null
            """)
    List<UUID> findIdsDueAutoRelease(@Param("now") Instant now);
}
