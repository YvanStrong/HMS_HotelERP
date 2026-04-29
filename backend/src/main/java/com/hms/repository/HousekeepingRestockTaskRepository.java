package com.hms.repository;

import com.hms.domain.RestockTaskStatus;
import com.hms.entity.HousekeepingRestockTask;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HousekeepingRestockTaskRepository extends JpaRepository<HousekeepingRestockTask, UUID> {

    long countByHotel_Id(UUID hotelId);

    boolean existsByRoom_IdAndInventoryItem_IdAndStatus(
            UUID roomId, UUID inventoryItemId, RestockTaskStatus status);

    List<HousekeepingRestockTask> findByHotel_IdAndStatusOrderByCreatedAtAsc(UUID hotelId, RestockTaskStatus status);
}
