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

    @Query(
            """
            select b from FacilityBooking b
            where b.facility.id = :facilityId
              and b.slot.startTime >= :startInclusive
              and b.slot.startTime < :endExclusive
            order by b.slot.startTime asc, b.createdAt desc
            """)
    List<FacilityBooking> findForFacilityWindow(
            @Param("facilityId") UUID facilityId,
            @Param("startInclusive") java.time.LocalDateTime startInclusive,
            @Param("endExclusive") java.time.LocalDateTime endExclusive);

    @Query(
            """
            select count(b) from FacilityBooking b
            where b.facility.id = :facilityId
              and b.slot.startTime >= :startInclusive
              and b.slot.startTime < :endExclusive
              and b.status <> com.hms.domain.FacilityBookingStatus.CANCELLED
            """)
    long countActiveForFacilityWindow(
            @Param("facilityId") UUID facilityId,
            @Param("startInclusive") java.time.LocalDateTime startInclusive,
            @Param("endExclusive") java.time.LocalDateTime endExclusive);

    @Query(
            """
            select count(b) from FacilityBooking b
            where b.facility.id = :facilityId
              and b.slot.startTime < :endExclusive
              and b.slot.endTime > :startInclusive
              and b.status <> com.hms.domain.FacilityBookingStatus.CANCELLED
            """)
    long countActiveOverlappingFacilityWindow(
            @Param("facilityId") UUID facilityId,
            @Param("startInclusive") java.time.LocalDateTime startInclusive,
            @Param("endExclusive") java.time.LocalDateTime endExclusive);

    @Query(
            """
            select coalesce(sum(b.amountPaid), 0) from FacilityBooking b
            where b.facility.id = :facilityId
              and b.slot.startTime >= :startInclusive
              and b.slot.startTime < :endExclusive
              and b.status <> com.hms.domain.FacilityBookingStatus.CANCELLED
            """)
    java.math.BigDecimal sumRevenueForFacilityWindow(
            @Param("facilityId") UUID facilityId,
            @Param("startInclusive") java.time.LocalDateTime startInclusive,
            @Param("endExclusive") java.time.LocalDateTime endExclusive);

    @Query(
            """
            select coalesce(sum(b.amountPaid), 0) from FacilityBooking b
            where b.facility.id = :facilityId
              and b.slot.startTime >= :startInclusive
              and b.slot.startTime < :endExclusive
              and b.status <> com.hms.domain.FacilityBookingStatus.CANCELLED
              and b.chargeToRoom = true
            """)
    java.math.BigDecimal sumRoomChargedRevenueForFacilityWindow(
            @Param("facilityId") UUID facilityId,
            @Param("startInclusive") java.time.LocalDateTime startInclusive,
            @Param("endExclusive") java.time.LocalDateTime endExclusive);

    @Query(
            """
            select coalesce(max(cast(substring(b.invoiceNumber, 10, 6) as int)), 0)
            from FacilityBooking b
            where b.invoiceNumber like concat(concat(concat('FAC-', :year), '-'), '%')
              and length(b.invoiceNumber) = 15
            """)
    int findMaxFacilityInvoiceSuffixForYear(@Param("year") String year);

    @Query(
            """
            select count(b) from FacilityBooking b
            where b.facility.id = :facilityId
              and b.status = com.hms.domain.FacilityBookingStatus.CHECKED_IN
            """)
    long countCheckedInByFacility(@Param("facilityId") UUID facilityId);

    @Query(
            """
            select b from FacilityBooking b
            join fetch b.facility f
            join fetch f.hotel h
            join fetch b.guest g
            where h.id = :hotelId
              and b.invoiceNumber is not null
            order by b.invoicedAt desc
            """)
    List<FacilityBooking> findInvoicedByHotelId(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select b from FacilityBooking b
            join fetch b.facility f
            join fetch f.hotel h
            join fetch b.guest g
            where h.id = :hotelId
              and b.invoiceNumber is not null
              and b.invoicedAt >= :from
              and b.invoicedAt < :to
            order by b.invoicedAt desc
            """)
    List<FacilityBooking> findInvoicedByHotelAndDateRange(
            @Param("hotelId") UUID hotelId,
            @Param("from") java.time.Instant from,
            @Param("to") java.time.Instant to);
}
