package com.hms.repository;

import com.hms.entity.GuestFeedback;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuestFeedbackRepository extends JpaRepository<GuestFeedback, UUID> {
    List<GuestFeedback> findByGuest_IdOrderBySubmittedAtDesc(UUID guestId);

    List<GuestFeedback> findByGuest_IdAndResolvedFalse(UUID guestId);

    List<GuestFeedback> findByGuest_Hotel_IdOrderBySubmittedAtDesc(UUID hotelId, Pageable pageable);

    @Query(
            """
            select f from GuestFeedback f
            join fetch f.guest g
            where g.hotel.id = :hotelId
            order by f.submittedAt desc
            """)
    List<GuestFeedback> findRecentForHotelWithGuest(@Param("hotelId") UUID hotelId, Pageable pageable);
}
