package com.hms.repository;

import com.hms.entity.PurchaseOrder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    Optional<PurchaseOrder> findByIdAndHotel_Id(UUID id, UUID hotelId);

    long countByHotel_Id(UUID hotelId);

    List<PurchaseOrder> findByHotel_IdOrderByOrderDateDesc(UUID hotelId);

    @Query(
            "select count(p) from PurchaseOrder p where p.hotel.id = :hotelId and p.status <> 'COMPLETED' and p.status <> 'CANCELLED'")
    long countOpenByHotel(@Param("hotelId") UUID hotelId);
}
