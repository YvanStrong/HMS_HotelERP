package com.hms.repository;

import com.hms.entity.WaitlistEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WaitlistEntryRepository extends JpaRepository<WaitlistEntry, UUID> {
    List<WaitlistEntry> findByHotel_IdAndStatusOrderByRequestedCheckInAsc(UUID hotelId, String status);
}
