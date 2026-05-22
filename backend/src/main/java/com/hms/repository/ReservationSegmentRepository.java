package com.hms.repository;

import com.hms.entity.ReservationSegment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationSegmentRepository extends JpaRepository<ReservationSegment, UUID> {
    List<ReservationSegment> findByReservation_IdOrderBySegmentStartAsc(UUID reservationId);
}
