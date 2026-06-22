package com.hms.repository;

import com.hms.entity.HotelInvoiceRefund;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HotelInvoiceRefundRepository extends JpaRepository<HotelInvoiceRefund, UUID> {

    @Query("select count(r) from HotelInvoiceRefund r where r.hotel.id = :hotelId")
    long countByHotelId(@Param("hotelId") UUID hotelId);

    boolean existsBySourceTypeAndSourceIdAndHotel_Id(String sourceType, UUID sourceId, UUID hotelId);

    @Query(
            """
            select r from HotelInvoiceRefund r
            where r.hotel.id = :hotelId
            order by r.createdAt desc
            """)
    List<HotelInvoiceRefund> findByHotelIdOrderByCreatedAtDesc(@Param("hotelId") UUID hotelId);
}
