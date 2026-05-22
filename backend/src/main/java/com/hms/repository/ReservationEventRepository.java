package com.hms.repository;

import com.hms.entity.ReservationEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationEventRepository extends JpaRepository<ReservationEvent, UUID> {
    List<ReservationEvent> findByReservation_IdOrderByCreatedAtDesc(UUID reservationId);
}
