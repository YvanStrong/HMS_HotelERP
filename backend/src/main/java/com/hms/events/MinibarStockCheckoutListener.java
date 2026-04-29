package com.hms.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.domain.ChargeType;
import com.hms.entity.InventoryItem;
import com.hms.entity.Room;
import com.hms.entity.RoomMinibarStock;
import com.hms.repository.InventoryItemRepository;
import com.hms.repository.RoomChargeRepository;
import com.hms.repository.RoomMinibarStockRepository;
import com.hms.repository.RoomRepository;
import com.hms.service.HousekeepingService;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * On checkout: applies MINIBAR consumption to per-room minibar stock (from charge metadata / SKU) and opens
 * housekeeping restock tasks when stock falls at or below {@link InventoryItem#getMinibarReorderThreshold()}.
 */
@Component
public class MinibarStockCheckoutListener {

    private final RoomRepository roomRepository;
    private final RoomChargeRepository roomChargeRepository;
    private final RoomMinibarStockRepository roomMinibarStockRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final HousekeepingService housekeepingService;
    private final ObjectMapper objectMapper;

    public MinibarStockCheckoutListener(
            RoomRepository roomRepository,
            RoomChargeRepository roomChargeRepository,
            RoomMinibarStockRepository roomMinibarStockRepository,
            InventoryItemRepository inventoryItemRepository,
            HousekeepingService housekeepingService,
            ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.roomChargeRepository = roomChargeRepository;
        this.roomMinibarStockRepository = roomMinibarStockRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.housekeepingService = housekeepingService;
        this.objectMapper = objectMapper;
    }

    @EventListener
    @Transactional
    public void onRoomCheckedOut(RoomCheckedOutEvent event) {
        Room room = roomRepository.findById(event.roomId()).orElse(null);
        if (room == null || !room.isHasMinibar()) {
            return;
        }
        UUID hotelId = event.hotelId();
        var charges = roomChargeRepository.findByReservation_IdAndChargeType(event.reservationId(), ChargeType.MINIBAR);
        for (var c : charges) {
            InventoryItem item = resolveInventoryItem(c, hotelId);
            if (item == null) {
                continue;
            }
            BigDecimal qty = resolveQuantity(c);
            var opt = roomMinibarStockRepository.findByRoom_IdAndInventoryItem_Id(event.roomId(), item.getId());
            if (opt.isEmpty()) {
                continue;
            }
            RoomMinibarStock st = opt.get();
            st.setCurrentStock(st.getCurrentStock().subtract(qty));
            roomMinibarStockRepository.save(st);

            Integer th = item.getMinibarReorderThreshold();
            if (th == null) {
                continue;
            }
            BigDecimal threshold = BigDecimal.valueOf(th);
            if (st.getCurrentStock().compareTo(threshold) > 0) {
                continue;
            }
            BigDecimal min = item.getMinimumStock() != null ? item.getMinimumStock() : BigDecimal.ZERO;
            BigDecimal suggested = min.subtract(st.getCurrentStock());
            if (suggested.signum() <= 0) {
                suggested = BigDecimal.ONE;
            }
            housekeepingService.createRestockTask(hotelId, event.roomId(), item, suggested);
        }
    }

    private InventoryItem resolveInventoryItem(com.hms.entity.RoomCharge c, UUID hotelId) {
        try {
            if (c.getMetadataJson() != null && !c.getMetadataJson().isBlank()) {
                JsonNode n = objectMapper.readTree(c.getMetadataJson());
                if (n.hasNonNull("inventoryItemId")) {
                    UUID itemId = UUID.fromString(n.get("inventoryItemId").asText());
                    return inventoryItemRepository.findByIdAndHotel_Id(itemId, hotelId).orElse(null);
                }
                if (n.hasNonNull("productSku")) {
                    return inventoryItemRepository
                            .findByHotel_IdAndSkuIgnoreCase(hotelId, n.get("productSku").asText())
                            .orElse(null);
                }
            }
            if (c.getProductSku() != null && !c.getProductSku().isBlank()) {
                return inventoryItemRepository
                        .findByHotel_IdAndSkuIgnoreCase(hotelId, c.getProductSku().trim())
                        .orElse(null);
            }
        } catch (Exception ignored) {
            // malformed metadata / sku
        }
        return null;
    }

    private BigDecimal resolveQuantity(com.hms.entity.RoomCharge c) {
        try {
            if (c.getMetadataJson() != null && !c.getMetadataJson().isBlank()) {
                JsonNode n = objectMapper.readTree(c.getMetadataJson());
                if (n.hasNonNull("quantity")) {
                    return new BigDecimal(n.get("quantity").asText());
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        return BigDecimal.valueOf(c.getQuantity() != null ? c.getQuantity() : 1);
    }
}
