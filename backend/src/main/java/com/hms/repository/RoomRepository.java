package com.hms.repository;

import com.hms.entity.Room;
import com.hms.domain.RoomStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomRepository extends JpaRepository<Room, UUID>, JpaSpecificationExecutor<Room> {

    long countByHotel_Id(UUID hotelId);

    /** Includes soft-deleted rooms; {@link #countByHotel_Id} may exclude them via {@code @SQLRestriction}. */
    @Query(value = "select count(*) from rooms where hotel_id = :hotelId", nativeQuery = true)
    long countAllRowsForHotel(@Param("hotelId") UUID hotelId);

    long countByHotel_IdAndRoomType_Id(UUID hotelId, UUID roomTypeId);

    Optional<Room> findByIdAndHotel_Id(UUID id, UUID hotelId);

    boolean existsByHotel_IdAndRoomNumberIgnoreCase(UUID hotelId, String roomNumber);

    List<Room> findByHotel_IdAndRoomType_Id(UUID hotelId, UUID roomTypeId);

    List<Room> findByHotel_IdAndStatus(UUID hotelId, RoomStatus status);

    List<Room> findByHotel_Id(UUID hotelId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "update Room r set r.deleted = true, r.updatedAt = :now where r.id = :id and r.hotel.id = :hotelId and r.deleted = false")
    int softDeleteByIdAndHotel_Id(@Param("id") UUID id, @Param("hotelId") UUID hotelId, @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "update Room r set r.dnd = false, r.dndUntil = null, r.dndSetAt = null where r.dnd = true and r.dndUntil is not null and r.dndUntil < :now")
    int clearExpiredDnd(@Param("now") Instant now);

    @Query(
            "select r.status, count(r) from Room r where r.hotel.id = :hotelId group by r.status")
    List<Object[]> countByStatusGrouped(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select r from Room r
            where r.hotel.id = :hotelId
            and r.dnd = true
            and r.dndSetAt is not null
            and r.dndSetAt < :cutoff
            order by r.roomNumber
            """)
    List<Room> findDndStale(@Param("hotelId") UUID hotelId, @Param("cutoff") Instant cutoff);
}
