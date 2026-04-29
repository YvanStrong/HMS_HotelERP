package com.hms.repository;

import com.hms.entity.Invoice;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    long countByHotel_Id(UUID hotelId);

    boolean existsByReservation_Id(UUID reservationId);

    @Query(
            "select coalesce(sum(i.totalAmount), 0) from Invoice i where i.hotel.id = :hotelId and i.createdAt >= :start and i.createdAt < :end")
    BigDecimal sumTotalAmountByHotelAndCreatedAtRange(
            @Param("hotelId") UUID hotelId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(
            "select count(i) from Invoice i where i.hotel.id = :hotelId and i.createdAt >= :start and i.createdAt < :end")
    long countByHotelAndCreatedAtRange(
            @Param("hotelId") UUID hotelId, @Param("start") Instant start, @Param("end") Instant end);

    /**
     * Max numeric suffix for invoices matching {@code INV-YYYY-#####} (9-char prefix + 5 digits, total
     * length 14). Uses the max existing suffix, not row count, so gaps do not produce duplicate numbers.
     */
    @Query(
            """
            select coalesce(max(cast(substring(i.invoiceNumber, 10, 5) as int)), 0)
            from Invoice i
            where i.invoiceNumber like concat(concat(concat('INV-', :year), '-'), '%')
              and length(i.invoiceNumber) = 14""")
    int findMaxInvoiceNumericSuffixForYear(@Param("year") String year);
}
