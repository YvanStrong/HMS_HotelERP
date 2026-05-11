package com.hms.repository;

import com.hms.entity.InvStockTransfer;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvStockTransferRepository extends JpaRepository<InvStockTransfer, UUID> {
    List<InvStockTransfer> findByHotel_IdOrderByTransferDateDescCreatedAtDesc(UUID hotelId);
    Optional<InvStockTransfer> findByIdAndHotel_Id(UUID id, UUID hotelId);
}
