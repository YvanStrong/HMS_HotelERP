package com.hms.repository;

import com.hms.entity.SensitiveIncident;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SensitiveIncidentRepository extends JpaRepository<SensitiveIncident, UUID> {

    List<SensitiveIncident> findByHotel_IdAndGuest_IdOrderByReportedAtDesc(UUID hotelId, UUID guestId);
}
