package com.hms.repository;

import com.hms.entity.Guest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuestRepository extends JpaRepository<Guest, UUID> {

    long countByHotel_Id(UUID hotelId);

    List<Guest> findByHotel_Id(UUID hotelId);

    Optional<Guest> findByIdAndHotel_Id(UUID id, UUID hotelId);

    Optional<Guest> findByHotel_IdAndEmailIgnoreCase(UUID hotelId, String email);

    Optional<Guest> findByHotel_IdAndPortalAccount_Id(UUID hotelId, UUID portalAccountId);

    Optional<Guest> findByHotel_IdAndNationalIdIgnoreCase(UUID hotelId, String nationalId);

    @Query(
            """
            select g from Guest g
            where g.hotel.id = :hotelId
            and (
              :q is null or :q = ''
              or lower(g.fullName) like lower(concat('%', :q, '%'))
              or lower(g.nationalId) like lower(concat('%', :q, '%'))
              or lower(concat(g.firstName, ' ', g.lastName)) like lower(concat('%', :q, '%'))
              or lower(g.email) like lower(concat('%', :q, '%'))
            )
            order by g.updatedAt desc
            """)
    List<Guest> searchGuestsForHotel(@Param("hotelId") UUID hotelId, @Param("q") String q);

    @Query("select count(r) from Reservation r where r.guest.id = :guestId and r.hotel.id = :hotelId")
    long countReservationsByGuest(@Param("guestId") UUID guestId, @Param("hotelId") UUID hotelId);

    @Query(
            "select coalesce(sum(r.totalAmount), 0) from Reservation r where r.guest.id = :guestId and r.hotel.id = :hotelId")
    BigDecimal sumLifetimeSpendByGuest(@Param("guestId") UUID guestId, @Param("hotelId") UUID hotelId);

    @Query(
            value =
                    "select coalesce(sum(check_out_date - check_in_date), 0) from reservations where guest_id = :guestId and hotel_id = :hotelId",
            nativeQuery = true)
    long sumNightsByGuest(@Param("guestId") UUID guestId, @Param("hotelId") UUID hotelId);
}
