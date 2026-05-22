package com.hms.repository;

import com.hms.entity.GroupRoomingListEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupRoomingListEntryRepository extends JpaRepository<GroupRoomingListEntry, UUID> {
    List<GroupRoomingListEntry> findByGroupBooking_IdOrderByCheckInDateAscGuestNameAsc(UUID groupBookingId);
}
