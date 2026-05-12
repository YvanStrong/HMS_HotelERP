package com.hms.repository;

import com.hms.domain.GuestComplaintSeverity;
import com.hms.domain.GuestComplaintStatus;
import com.hms.entity.GuestComplaint;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuestComplaintRepository extends JpaRepository<GuestComplaint, UUID> {

    @EntityGraph(attributePaths = {"guest", "reservation", "assignedTo", "hotel"})
    Optional<GuestComplaint> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @EntityGraph(attributePaths = {"guest", "reservation", "assignedTo"})
    List<GuestComplaint> findByHotel_IdOrderByOpenedAtDesc(UUID hotelId, Pageable pageable);

    @EntityGraph(attributePaths = {"guest", "reservation", "assignedTo"})
    List<GuestComplaint> findByHotel_IdAndGuest_IdOrderByOpenedAtDesc(UUID hotelId, UUID guestId);

    long countByHotel_IdAndStatusIn(UUID hotelId, Collection<GuestComplaintStatus> statuses);

    long countByHotel_IdAndSeverityAndStatusIn(
            UUID hotelId, GuestComplaintSeverity severity, Collection<GuestComplaintStatus> statuses);

    boolean existsByGuest_IdAndHotel_IdAndStatusIn(
            UUID guestId, UUID hotelId, Collection<GuestComplaintStatus> statuses);

    long countByGuest_IdAndHotel_IdAndStatusIn(UUID guestId, UUID hotelId, Collection<GuestComplaintStatus> statuses);

    @Query(
            "select c.type, count(c) from GuestComplaint c where c.hotel.id = :hotelId and c.openedAt >= :from group by c.type order by count(c) desc")
    List<Object[]> countByTypeSince(@Param("hotelId") UUID hotelId, @Param("from") Instant from);

    @Query(
            "select u.id, u.username, count(c) from GuestComplaint c join c.assignedTo u where c.hotel.id = :hotelId and c.assignedTo is not null and c.openedAt >= :from group by u.id, u.username order by count(c) desc")
    List<Object[]> countByAssignedStaffSince(@Param("hotelId") UUID hotelId, @Param("from") Instant from);

    @Query(
            value =
                    "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - opened_at)) / 3600.0) FROM guest_complaints WHERE hotel_id = :hotelId AND resolved_at IS NOT NULL AND status IN ('RESOLVED','CLOSED') AND opened_at >= :from",
            nativeQuery = true)
    Double averageResolutionHoursSince(@Param("hotelId") UUID hotelId, @Param("from") Instant from);

    @Query("select count(c) from GuestComplaint c where c.hotel.id = :hotelId and c.openedAt >= :from")
    long countByHotel_IdAndOpenedAtGreaterThanEqual(@Param("hotelId") UUID hotelId, @Param("from") Instant from);
}
