package com.hms.repository;

import com.hms.entity.PurchaseOrder;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    Optional<PurchaseOrder> findByIdAndHotel_Id(UUID id, UUID hotelId);

    long countByHotel_Id(UUID hotelId);
}
