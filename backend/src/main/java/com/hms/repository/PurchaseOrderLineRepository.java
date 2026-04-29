package com.hms.repository;

import com.hms.entity.PurchaseOrderLine;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderLineRepository extends JpaRepository<PurchaseOrderLine, UUID> {

    Optional<PurchaseOrderLine> findByIdAndPurchaseOrder_Hotel_Id(UUID lineId, UUID hotelId);
}
