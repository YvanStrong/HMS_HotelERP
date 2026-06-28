package com.hms.repository;

import com.hms.entity.PosLineAudit;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosLineAuditRepository extends JpaRepository<PosLineAudit, UUID> {

    @Query(
            "SELECT a FROM PosLineAudit a "
                    + "JOIN FETCH a.ticket t "
                    + "JOIN FETCH a.line l "
                    + "JOIN FETCH a.authorizedBy "
                    + "JOIN FETCH a.createdBy "
                    + "WHERE a.ticket.id = :ticketId ORDER BY a.createdAt DESC")
    List<PosLineAudit> findByTicketId(@Param("ticketId") UUID ticketId);

    @Query(
            value =
                    "SELECT a FROM PosLineAudit a "
                            + "WHERE a.hotel.id = :hotelId AND a.createdAt >= :from AND a.createdAt < :to",
            countQuery =
                    "SELECT COUNT(a) FROM PosLineAudit a "
                            + "WHERE a.hotel.id = :hotelId AND a.createdAt >= :from AND a.createdAt < :to")
    Page<PosLineAudit> findByHotelIdAndCreatedAtBetween(
            @Param("hotelId") UUID hotelId,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query(
            "SELECT COALESCE(SUM(a.discountAmount), 0) FROM PosLineAudit a "
                    + "WHERE a.ticket.shift.id = :shiftId AND a.action = com.hms.domain.PosLineAuditAction.DISCOUNT")
    java.math.BigDecimal sumDiscountAmountByShiftId(@Param("shiftId") UUID shiftId);

    @Query(
            "SELECT COALESCE(SUM(a.discountAmount), 0) FROM PosLineAudit a "
                    + "WHERE a.hotel.id = :hotelId AND a.createdAt >= :from AND a.createdAt < :to "
                    + "AND a.action = com.hms.domain.PosLineAuditAction.DISCOUNT")
    java.math.BigDecimal sumDiscountAmountByHotelBetween(
            @Param("hotelId") UUID hotelId, @Param("from") Instant from, @Param("to") Instant to);

    @Query(
            "SELECT COUNT(a) FROM PosLineAudit a "
                    + "WHERE a.hotel.id = :hotelId AND a.createdAt >= :from AND a.createdAt < :to "
                    + "AND a.action = com.hms.domain.PosLineAuditAction.VOID")
    long countVoidsByHotelBetween(
            @Param("hotelId") UUID hotelId, @Param("from") Instant from, @Param("to") Instant to);
}
