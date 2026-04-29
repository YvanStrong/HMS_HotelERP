package com.hms.repository;

import com.hms.domain.FacilityBookingStatus;
import com.hms.entity.FacilityBooking;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FacilityBookingRepository extends JpaRepository<FacilityBooking, UUID> {

    Optional<FacilityBooking> findByIdAndFacility_Hotel_Id(UUID id, UUID hotelId);

    @Query(
            """
            select coalesce(sum(b.guestCount), 0) from FacilityBooking b
            where b.facility.id = :facilityId and b.status = :status
            """)
    Long sumCheckedInGuestCountByFacilityId(
            @Param("facilityId") UUID facilityId, @Param("status") FacilityBookingStatus status);

    List<FacilityBooking> findBySlot_IdAndStatusIn(UUID slotId, List<FacilityBookingStatus> statuses);

    @Query(
            """
            select coalesce(sum(b.guestCount), 0) from FacilityBooking b
            where b.slot.id = :slotId and b.status in :statuses
            """)
    Long sumGuestCountOnSlot(
            @Param("slotId") UUID slotId, @Param("statuses") List<FacilityBookingStatus> statuses);

    List<FacilityBooking> findBySlot_IdAndStatus(UUID slotId, FacilityBookingStatus status);
}
