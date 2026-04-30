package com.hms.repository;

import com.hms.entity.NightAuditRun;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NightAuditRunRepository extends JpaRepository<NightAuditRun, UUID> {

    Optional<NightAuditRun> findByHotel_IdAndRunDate(UUID hotelId, LocalDate runDate);

    List<NightAuditRun> findTop30ByHotel_IdOrderByRunDateDesc(UUID hotelId);
}
