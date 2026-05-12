package com.hms.repository;

import com.hms.domain.FolioStatus;
import com.hms.domain.ReservationStatus;
import com.hms.entity.Reservation;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservationRepository extends JpaRepository<Reservation, UUID> {

    long countByHotel_Id(UUID hotelId);

    List<Reservation> findByHotel_Id(UUID hotelId);

    Optional<Reservation> findFirstByGuest_IdAndHotel_IdOrderByCheckInDateDesc(UUID guestId, UUID hotelId);

    Optional<Reservation> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @Query(
            "select r from Reservation r join fetch r.guest g left join fetch g.portalAccount join fetch r.room join fetch r.room.roomType join fetch r.hotel where r.id = :id and r.hotel.id = :hotelId")
    Optional<Reservation> findDetailedByIdAndHotel_Id(@Param("id") UUID id, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select r from Reservation r
            left join fetch r.groupBooking gb
            left join fetch gb.masterReservation
            left join fetch gb.corporateAccount
            where r.id = :id and r.hotel.id = :hotelId
            """)
    Optional<Reservation> findByIdAndHotel_IdWithGroupBilling(@Param("id") UUID id, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select r from Reservation r
            join fetch r.guest
            join fetch r.hotel
            left join fetch r.room rm
            left join fetch rm.roomType
            left join fetch r.groupBooking gb
            left join fetch gb.masterReservation
            left join fetch gb.corporateAccount
            where r.id = :id and r.hotel.id = :hotelId
            """)
    Optional<Reservation> findForCheckoutWithGroupBilling(@Param("id") UUID id, @Param("hotelId") UUID hotelId);

    @Query(
            """
            select count(r) from Reservation r
            where r.room.id = :roomId
            and r.status in ('CONFIRMED', 'CHECKED_IN')
            and r.checkInDate < :checkOut
            and r.checkOutDate > :checkIn
            and (:excludeId is null or r.id <> :excludeId)
            """)
    long countOverlapping(
            @Param("roomId") UUID roomId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("excludeId") UUID excludeReservationId);

    List<Reservation> findByHotel_IdAndStatusIn(UUID hotelId, List<ReservationStatus> statuses);

    List<Reservation> findByRoom_IdAndStatusInOrderByCheckInDateDesc(
            UUID roomId, java.util.Collection<ReservationStatus> statuses);

    @Query(
            "select distinct r from Reservation r join fetch r.guest join fetch r.room where r.room.id in :roomIds and r.status in :statuses order by r.updatedAt desc")
    List<Reservation> findByRoom_IdInAndStatusIn(
            @Param("roomIds") java.util.List<UUID> roomIds,
            @Param("statuses") java.util.Collection<ReservationStatus> statuses);

    @Query(
            """
            select count(distinct r.room.id) from Reservation r
            where r.hotel.id = :hotelId
            and r.room is not null
            and r.status in ('CONFIRMED', 'CHECKED_IN')
            and r.checkInDate <= :day
            and r.checkOutDate > :day
            """)
    long countDistinctOccupiedRoomsForNight(@Param("hotelId") UUID hotelId, @Param("day") LocalDate day);

    @Query(
            "select count(r) from Reservation r where r.hotel.id = :hotelId and r.checkInDate = :day and r.status in ('CONFIRMED','CHECKED_IN')")
    long countArrivalsOnDate(@Param("hotelId") UUID hotelId, @Param("day") LocalDate day);

    @Query(
            "select count(r) from Reservation r where r.hotel.id = :hotelId and r.checkOutDate = :day and r.status in ('CONFIRMED','CHECKED_IN')")
    long countDeparturesOnDate(@Param("hotelId") UUID hotelId, @Param("day") LocalDate day);

    @Query(
            "select count(r) from Reservation r where r.hotel.id = :hotelId and r.checkInDate = :day and r.status = 'CHECKED_IN'")
    long countArrivalsCheckedInOnDate(@Param("hotelId") UUID hotelId, @Param("day") LocalDate day);

    @Query(
            "select count(r) from Reservation r where r.hotel.id = :hotelId and r.checkOutDate = :day and r.status = 'CHECKED_OUT'")
    long countDeparturesCheckedOutOnDate(@Param("hotelId") UUID hotelId, @Param("day") LocalDate day);

    @Query(
            """
            select coalesce(sum(r.totalAmount), 0) from Reservation r
            where r.hotel.id = :hotelId
            and r.status in ('CONFIRMED', 'CHECKED_IN')
            and r.checkInDate <= :day
            and r.checkOutDate > :day
            """)
    BigDecimal sumTotalAmountForOccupiedNight(@Param("hotelId") UUID hotelId, @Param("day") LocalDate day);

    long countByHotel_IdAndCheckInDateBetween(UUID hotelId, LocalDate fromInclusive, LocalDate toInclusive);

    @Query(
            "select count(r) from Reservation r where r.hotel.id = :hotelId and r.createdAt >= :start and r.createdAt < :end")
    long countByHotel_IdAndCreatedAtBetween(
            @Param("hotelId") UUID hotelId, @Param("start") Instant start, @Param("end") Instant end);

    @Query("select r.hotel.id from Reservation r where r.id = :id")
    Optional<UUID> findHotelIdById(@Param("id") UUID id);

    @Query(
            """
            select r from Reservation r
            join fetch r.guest
            join fetch r.hotel
            left join fetch r.room rm
            left join fetch rm.roomType
            where lower(r.confirmationCode) = lower(:confirmation)
            """)
    Optional<Reservation> findByConfirmationCodeIgnoreCase(@Param("confirmation") String confirmationCode);

    @Query(
            """
            select r from Reservation r
            join fetch r.guest g
            left join fetch g.portalAccount
            left join fetch r.bookedByAppUser
            left join fetch r.room rm
            where r.hotel.id = :hotelId
            and r.checkOutDate > :stayStart
            and r.checkInDate < :stayEnd
            and r.status in :statuses
            and (coalesce(:q, '') = ''
                or lower(r.confirmationCode) like lower(concat('%', :q, '%'))
                or lower(r.bookingReference) like lower(concat('%', :q, '%'))
                or lower(concat(g.firstName, ' ', g.lastName)) like lower(concat('%', :q, '%'))
                or lower(g.fullName) like lower(concat('%', :q, '%'))
                or lower(g.nationalId) like lower(concat('%', :q, '%'))
                or lower(g.email) like lower(concat('%', :q, '%')))
            order by r.checkInDate desc, r.bookingReference asc
            """)
    List<Reservation> searchForHotelStaff(
            @Param("hotelId") UUID hotelId,
            @Param("stayStart") LocalDate stayStart,
            @Param("stayEnd") LocalDate stayEnd,
            @Param("statuses") List<ReservationStatus> statuses,
            @Param("q") String q);

    @Query(
            """
            select r from Reservation r
            join fetch r.guest
            left join fetch r.room rm
            where r.hotel.id = :hotelId
              and r.checkInDate = :day
              and r.status in :statuses
            order by r.createdAt desc
            """)
    List<Reservation> findArrivalsForDashboard(
            @Param("hotelId") UUID hotelId,
            @Param("day") LocalDate day,
            @Param("statuses") List<ReservationStatus> statuses);

    @Query(
            """
            select r from Reservation r
            join fetch r.guest
            left join fetch r.room rm
            where r.hotel.id = :hotelId
              and r.checkOutDate = :day
              and r.status in :statuses
            order by r.createdAt desc
            """)
    List<Reservation> findDeparturesForDashboard(
            @Param("hotelId") UUID hotelId,
            @Param("day") LocalDate day,
            @Param("statuses") List<ReservationStatus> statuses);

    List<Reservation> findByHotel_IdAndFolioStatus(UUID hotelId, FolioStatus folioStatus);

    List<Reservation> findTop20ByHotel_IdOrderByUpdatedAtDesc(UUID hotelId);

    @Query(
            value =
                    "select coalesce(max(cast(right(r.booking_reference, 6) as integer)), 0) from reservations r "
                            + "where r.booking_reference like :prefix and length(r.booking_reference) = 15",
            nativeQuery = true)
    int maxBookingReferenceSuffixForYear(@Param("prefix") String prefix);

    @Query(
            """
            select r from Reservation r
            join fetch r.hotel
            join fetch r.guest
            left join fetch r.room rm
            left join fetch rm.roomType
            where r.guest.id = :guestId
            order by r.checkInDate desc
            """)
    List<Reservation> findByGuest_IdOrderByCheckInDateDesc(@Param("guestId") UUID guestId);

    @Query(
            """
            select r from Reservation r
            join fetch r.room rm
            join fetch r.guest
            join fetch r.hotel
            where r.hotel.id = :hotelId
            and r.status = :status
            and upper(trim(rm.roomNumber)) = upper(trim(:roomNumber))
            and (
                upper(trim(r.confirmationCode)) = upper(trim(:bookingCode))
                or upper(trim(r.bookingReference)) = upper(trim(:bookingCode))
            )
            """)
    Optional<Reservation> findCheckedInByRoomNumberAndBookingOrConfirmation(
            @Param("hotelId") UUID hotelId,
            @Param("status") ReservationStatus status,
            @Param("roomNumber") String roomNumber,
            @Param("bookingCode") String bookingCode);

    List<Reservation> findByGuest_Id(UUID guestId);

    @Query(
            """
            select r from Reservation r
            join fetch r.hotel
            join fetch r.guest g
            left join fetch r.room rm
            left join fetch rm.roomType
            where r.hotel.id = :hotelId and g.id = :guestId
            order by r.checkInDate desc
            """)
    List<Reservation> findByHotel_IdAndGuest_IdOrderByCheckInDateDesc(
            @Param("hotelId") UUID hotelId, @Param("guestId") UUID guestId);

    List<Reservation> findByGroupBooking_Id(UUID groupId);

    List<Reservation> findByCheckInDateAndStatus(LocalDate checkInDate, ReservationStatus status);

    List<Reservation> findByCheckOutDateAndStatus(LocalDate checkOutDate, ReservationStatus status);
}
