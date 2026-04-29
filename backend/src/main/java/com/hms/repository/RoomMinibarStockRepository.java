package com.hms.repository;

import com.hms.entity.RoomMinibarStock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomMinibarStockRepository extends JpaRepository<RoomMinibarStock, UUID> {

    Optional<RoomMinibarStock> findByRoom_IdAndInventoryItem_Id(UUID roomId, UUID inventoryItemId);

    List<RoomMinibarStock> findByRoom_Id(UUID roomId);
}
