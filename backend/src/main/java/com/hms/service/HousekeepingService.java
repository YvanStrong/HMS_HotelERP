package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.CleanlinessStatus;
import com.hms.domain.RestockTaskStatus;
import com.hms.domain.RoomStatus;
import com.hms.entity.HousekeepingRestockTask;
import com.hms.entity.InventoryItem;
import com.hms.entity.Room;
import com.hms.repository.HousekeepingRestockTaskRepository;
import com.hms.repository.RoomRepository;
import com.hms.security.TenantAccessService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HousekeepingService {

    private final RoomRepository roomRepository;
    private final HousekeepingRestockTaskRepository housekeepingRestockTaskRepository;
    private final TenantAccessService tenantAccessService;
    private final TenantScopedCollectionService tenantScopedCollectionService;

    public HousekeepingService(
            RoomRepository roomRepository,
            HousekeepingRestockTaskRepository housekeepingRestockTaskRepository,
            TenantAccessService tenantAccessService,
            TenantScopedCollectionService tenantScopedCollectionService) {
        this.roomRepository = roomRepository;
        this.housekeepingRestockTaskRepository = housekeepingRestockTaskRepository;
        this.tenantAccessService = tenantAccessService;
        this.tenantScopedCollectionService = tenantScopedCollectionService;
    }

    /**
     * Creates an OPEN minibar restock task for housekeeping when room-level stock falls at or below threshold.
     * Skips if an OPEN task already exists for the same room and inventory item.
     */
    @Transactional
    public HousekeepingRestockTask createRestockTask(
            UUID hotelId, UUID roomId, InventoryItem inventoryItem, BigDecimal quantitySuggested) {
        if (quantitySuggested == null || quantitySuggested.signum() <= 0) {
            return null;
        }
        if (housekeepingRestockTaskRepository.existsByRoom_IdAndInventoryItem_IdAndStatus(
                roomId, inventoryItem.getId(), RestockTaskStatus.OPEN)) {
            return null;
        }
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found for hotel"));
        HousekeepingRestockTask t = new HousekeepingRestockTask();
        t.setHotel(room.getHotel());
        t.setRoom(room);
        t.setInventoryItem(inventoryItem);
        t.setSkuSnapshot(inventoryItem.getSku());
        t.setItemNameSnapshot(inventoryItem.getName());
        t.setQuantitySuggested(quantitySuggested);
        t.setStatus(RestockTaskStatus.OPEN);
        t.setNotes("Auto: minibar below reorder threshold after checkout");
        return housekeepingRestockTaskRepository.save(t);
    }

    @Transactional(readOnly = true)
    public ApiDtos.HousekeepingTasksResponse tasks(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<Room> rooms =
                tenantScopedCollectionService.enforceTenantRooms(tenantScopedCollectionService.mutableCopy(
                        roomRepository.findByHotel_Id(hotelId)));
        List<ApiDtos.HousekeepingTask> tasks = new ArrayList<>();
        int inProgress = 0;
        int readyForInspection = 0;
        int totalDirty = 0;
        int skippedDnd = 0;
        for (Room r : rooms) {
            if (r.isDnd() && (r.getDndUntil() == null || r.getDndUntil().isAfter(Instant.now()))) {
                skippedDnd++;
                continue;
            }
            boolean needsClean = r.getStatus() == RoomStatus.VACANT_DIRTY || r.getCleanliness() == CleanlinessStatus.DIRTY;
            if (needsClean) {
                totalDirty++;
                String priority = r.getStatus() == RoomStatus.VACANT_DIRTY ? "HIGH" : "MEDIUM";
                List<String> actions = new ArrayList<>(List.of("clean", "restock_minibar"));
                if (r.getCleanliness() == CleanlinessStatus.CLEAN) {
                    actions.add("inspect");
                } else {
                    actions.add("inspect");
                }
                tasks.add(new ApiDtos.HousekeepingTask(
                        r.getId(),
                        r.getRoomNumber(),
                        priority,
                        r.getStatus().name(),
                        actions,
                        25,
                        null));
            }
            if (r.getCleanliness() == CleanlinessStatus.CLEAN && r.getStatus() == RoomStatus.VACANT_DIRTY) {
                inProgress++;
            }
            if (r.getCleanliness() == CleanlinessStatus.CLEAN && r.getStatus() == RoomStatus.VACANT_CLEAN) {
                readyForInspection++;
            }
        }
        List<HousekeepingRestockTask> openRestock =
                housekeepingRestockTaskRepository.findByHotel_IdAndStatusOrderByCreatedAtAsc(hotelId, RestockTaskStatus.OPEN);
        List<ApiDtos.HousekeepingRestockTaskDto> restockDtos = new ArrayList<>();
        for (HousekeepingRestockTask t : openRestock) {
            restockDtos.add(new ApiDtos.HousekeepingRestockTaskDto(
                    t.getId(),
                    t.getRoom().getId(),
                    t.getRoom().getRoomNumber(),
                    t.getSkuSnapshot(),
                    t.getItemNameSnapshot(),
                    t.getQuantitySuggested(),
                    t.getStatus().name()));
        }
        return new ApiDtos.HousekeepingTasksResponse(
                tasks,
                new ApiDtos.HousekeepingSummary(totalDirty, inProgress, readyForInspection, skippedDnd),
                restockDtos);
    }
}
