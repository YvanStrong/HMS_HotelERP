package com.hms.repository;

import com.hms.entity.InvSalesInvoice;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvSalesInvoiceRepository extends JpaRepository<InvSalesInvoice, UUID> {
    List<InvSalesInvoice> findByHotel_IdOrderByInvoiceDateDescCreatedAtDesc(UUID hotelId);
    Optional<InvSalesInvoice> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @Query("select coalesce(sum(i.totalAmount), 0) from InvSalesInvoice i where i.hotel.id = :hotelId and i.invoiceDate >= :from and i.invoiceDate <= :to and i.status <> 'CANCELLED'")
    BigDecimal sumRevenue(@Param("hotelId") UUID hotelId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select coalesce(sum(i.amountPaid), 0) from InvSalesInvoice i where i.hotel.id = :hotelId and i.invoiceDate >= :from and i.invoiceDate <= :to and i.status <> 'CANCELLED'")
    BigDecimal sumPaid(@Param("hotelId") UUID hotelId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select count(i) from InvSalesInvoice i where i.hotel.id = :hotelId and i.invoiceDate >= :from and i.invoiceDate <= :to and i.status <> 'CANCELLED'")
    long countInvoices(@Param("hotelId") UUID hotelId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select i from InvSalesInvoice i where i.hotel.id = :hotelId and i.invoiceDate >= :from and i.invoiceDate <= :to and i.status <> 'CANCELLED' order by i.invoiceDate desc, i.createdAt desc")
    List<InvSalesInvoice> findByHotelAndDateRange(@Param("hotelId") UUID hotelId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select coalesce(sum(i.totalAmount), 0) from InvSalesInvoice i where i.hotel.id = :hotelId and i.invoiceDate = :today and i.status <> 'CANCELLED'")
    BigDecimal sumTodaySales(@Param("hotelId") UUID hotelId, @Param("today") LocalDate today);

    long countByHotel_IdAndStatus(UUID hotelId, String status);
}
