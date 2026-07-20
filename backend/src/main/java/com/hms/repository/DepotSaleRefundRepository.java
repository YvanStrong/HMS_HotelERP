package com.hms.repository;

import com.hms.entity.DepotSaleRefund;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DepotSaleRefundRepository extends JpaRepository<DepotSaleRefund, UUID> {

    @Query("select count(r) from DepotSaleRefund r where r.hotel.id = :hotelId")
    long countByHotelId(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select distinct r from DepotSaleRefund r
            join fetch r.sale s
            join fetch s.depot d
            where r.hotel.id = :hotelId
            order by r.createdAt desc
            """)
    List<DepotSaleRefund> findByHotelIdOrderByCreatedAtDesc(@Param("hotelId") UUID hotelId);

    boolean existsBySale_IdAndHotel_Id(UUID saleId, UUID hotelId);
}
