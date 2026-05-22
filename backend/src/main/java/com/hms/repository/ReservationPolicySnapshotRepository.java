package com.hms.repository;

import com.hms.entity.ReservationPolicySnapshot;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationPolicySnapshotRepository extends JpaRepository<ReservationPolicySnapshot, UUID> {
    Optional<ReservationPolicySnapshot> findByReservation_Id(UUID reservationId);
}
