package com.hms.repository;

import com.hms.entity.PosAnnouncement;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosAnnouncementRepository extends JpaRepository<PosAnnouncement, UUID> {

    @Query(
            """
            select a from PosAnnouncement a
            left join fetch a.depot
            where a.hotel.id = :hotelId
              and a.active = true
              and (a.expiresAt is null or a.expiresAt > :now)
              and (:depotId is null or a.depot is null or a.depot.id = :depotId)
              and a.id not in (
                select r.announcementId from PosAnnouncementRead r where r.userId = :userId
              )
            order by a.createdAt desc
            """)
    List<PosAnnouncement> findUnreadForUser(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("userId") UUID userId,
            @Param("now") java.time.Instant now);

    @Query(
            """
            select a from PosAnnouncement a
            left join fetch a.depot
            where a.hotel.id = :hotelId
              and a.active = true
              and (a.expiresAt is null or a.expiresAt > :now)
            order by a.createdAt desc
            """)
    List<PosAnnouncement> findActiveForHotel(@Param("hotelId") UUID hotelId, @Param("now") java.time.Instant now);

    java.util.Optional<PosAnnouncement> findByIdAndHotel_Id(UUID id, UUID hotelId);
}
