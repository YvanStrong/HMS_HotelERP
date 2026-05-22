package com.hms.repository;

import com.hms.entity.ReservationGuest;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationGuestRepository extends JpaRepository<ReservationGuest, UUID> {
    List<ReservationGuest> findByReservation_IdOrderByCreatedAtAsc(UUID reservationId);
}
