package com.hms.repository;

import com.hms.entity.GroupBooking;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GroupBookingRepository extends JpaRepository<GroupBooking, UUID> {
    List<GroupBooking> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    Optional<GroupBooking> findByIdAndHotel_Id(UUID id, UUID hotelId);

    boolean existsByIdAndHotel_Id(UUID id, UUID hotelId);

    boolean existsByGroupCodeIgnoreCase(String groupCode);

    @Query(
            """
            select gb from GroupBooking gb
            left join fetch gb.masterReservation
            left join fetch gb.corporateAccount
            where gb.id = :id and gb.hotel.id = :hotelId
            """)
    Optional<GroupBooking> findWithBillingRelations(@Param("id") UUID id, @Param("hotelId") UUID hotelId);
}
