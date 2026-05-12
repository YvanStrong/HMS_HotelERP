package com.hms.repository;

import com.hms.entity.GuestFolio;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuestFolioRepository extends JpaRepository<GuestFolio, UUID> {

    Optional<GuestFolio> findByReservation_Id(UUID reservationId);
}
