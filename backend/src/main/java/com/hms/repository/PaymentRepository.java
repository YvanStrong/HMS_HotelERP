package com.hms.repository;

import com.hms.entity.Payment;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByReservation_IdOrderByProcessedAtDesc(UUID reservationId);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.reservation.id = :rid and p.status = 'COMPLETED'")
    BigDecimal sumCompletedForReservation(@Param("rid") UUID reservationId);

    @Query(
            "select coalesce(sum(p.amount), 0) from Payment p where p.hotel.id = :hotelId and p.status = 'COMPLETED' and p.processedAt >= :start and p.processedAt < :end")
    BigDecimal sumCompletedForHotelInRange(@Param("hotelId") UUID hotelId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(
            "select count(distinct p.reservation.id) from Payment p where p.hotel.id = :hotelId and p.status = 'COMPLETED' and p.processedAt >= :start and p.processedAt < :end")
    long countDistinctReservationsPaidInRange(
            @Param("hotelId") UUID hotelId, @Param("start") Instant start, @Param("end") Instant end);

    List<Payment> findTop20ByHotel_IdOrderByProcessedAtDesc(UUID hotelId);
}
