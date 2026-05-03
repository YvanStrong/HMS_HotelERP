package com.hms.repository;

import com.hms.domain.ChargeType;
import com.hms.entity.RoomCharge;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomChargeRepository extends JpaRepository<RoomCharge, UUID> {

    List<RoomCharge> findByReservation_IdOrderByChargedAtDesc(UUID reservationId);

    List<RoomCharge> findByReservation_IdAndChargeType(UUID reservationId, ChargeType chargeType);

    @Query("select coalesce(sum(c.amount), 0) from RoomCharge c where c.reservation.id = :rid")
    BigDecimal sumAmountForReservation(@Param("rid") UUID reservationId);

    @Query(
            """
            select count(c) from RoomCharge c
            where c.reservation.id = :reservationId
            and c.chargeType = :chargeType
            and c.chargedAt >= :fromTs
            and c.chargedAt < :toTs
            """)
    long countForReservationTypeBetween(
            @Param("reservationId") UUID reservationId,
            @Param("chargeType") ChargeType chargeType,
            @Param("fromTs") Instant fromTs,
            @Param("toTs") Instant toTs);

    List<RoomCharge> findTop20ByReservation_Hotel_IdOrderByChargedAtDesc(UUID hotelId);
}
