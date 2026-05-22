package com.hms.repository;

import com.hms.entity.GroupAllotment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupAllotmentRepository extends JpaRepository<GroupAllotment, UUID> {
    List<GroupAllotment> findByGroupBooking_IdOrderByAllotmentDateAsc(UUID groupBookingId);
}
