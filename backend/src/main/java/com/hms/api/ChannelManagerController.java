package com.hms.api;

import com.hms.entity.*;
import com.hms.repository.HotelRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.service.ChannelManagerService;
import com.hms.security.CheckModuleEntitlement;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Channel manager endpoints — OTA connections, rate plans, and sync operations.
 */
@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/channels")
@CheckModuleEntitlement("REVENUE_CHANNELS")
public class ChannelManagerController {

    private final ChannelManagerService channelService;
    private final HotelRepository hotelRepo;
    private final RoomTypeRepository roomTypeRepo;

    public ChannelManagerController(ChannelManagerService channelService,
                                     HotelRepository hotelRepo,
                                     RoomTypeRepository roomTypeRepo) {
        this.channelService = channelService;
        this.hotelRepo = hotelRepo;
        this.roomTypeRepo = roomTypeRepo;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<ChannelConnection> listConnections(@PathVariable UUID hotelId) {
        return channelService.listConnections(hotelId);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ResponseEntity<ChannelConnection> createConnection(
            @PathVariable UUID hotelId,
            @RequestBody Map<String, Object> body) {
        ChannelConnection conn = new ChannelConnection();
        conn.setChannelCode(body.getOrDefault("channelCode", "").toString());
        conn.setStatus(body.getOrDefault("status", "DISCONNECTED").toString());
        conn.setCredentials(body.containsKey("credentials") ? body.get("credentials").toString() : null);
        conn.setConfig(body.containsKey("config") ? body.get("config").toString() : null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(channelService.createConnection(hotelId, conn));
    }

    @PatchMapping("/{connectionId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ChannelConnection updateStatus(
            @PathVariable UUID hotelId,
            @PathVariable UUID connectionId,
            @RequestBody Map<String, String> body) {
        return channelService.updateStatus(connectionId, body.getOrDefault("status", "DISCONNECTED"));
    }

    @DeleteMapping("/{connectionId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ResponseEntity<Void> deleteConnection(
            @PathVariable UUID hotelId, @PathVariable UUID connectionId) {
        channelService.deleteConnection(connectionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{connectionId}/sync")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public Map<String, Object> triggerSync(
            @PathVariable UUID hotelId, @PathVariable UUID connectionId) {
        return channelService.triggerSync(hotelId);
    }

    @GetMapping("/{connectionId}/logs")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public Page<ChannelSyncLog> getSyncLog(
            @PathVariable UUID hotelId,
            @PathVariable UUID connectionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return channelService.getSyncLog(connectionId, page, size);
    }

    // --- Rate Plans ---

    @GetMapping("/{connectionId}/rate-plans")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<ChannelRatePlan> listRatePlans(
            @PathVariable UUID hotelId, @PathVariable UUID connectionId) {
        return channelService.listRatePlans(connectionId);
    }

    @PostMapping("/{connectionId}/rate-plans")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ResponseEntity<ChannelRatePlan> createRatePlan(
            @PathVariable UUID hotelId,
            @PathVariable UUID connectionId,
            @RequestBody Map<String, Object> body) {
        ChannelRatePlan plan = new ChannelRatePlan();
        // Connection will be set from path
        plan.setConnection(channelService.listConnections(hotelId).stream()
                .filter(c -> c.getId().equals(connectionId)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CONNECTION_NOT_FOUND", "Connection not found")));
        plan.setRoomType(roomTypeRepo.findById(UUID.fromString(body.get("roomTypeId").toString()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROOM_TYPE_NOT_FOUND", "Room type not found")));
        plan.setChannelRoomCode((String) body.get("channelRoomCode"));
        plan.setRateMarkupPct(new BigDecimal(body.getOrDefault("rateMarkupPct", "0").toString()));
        plan.setMinStay(Integer.parseInt(body.getOrDefault("minStay", "1").toString()));
        return ResponseEntity.status(HttpStatus.CREATED).body(channelService.createRatePlan(plan));
    }

    @DeleteMapping("/{connectionId}/rate-plans/{planId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ResponseEntity<Void> deleteRatePlan(
            @PathVariable UUID hotelId,
            @PathVariable UUID connectionId,
            @PathVariable UUID planId) {
        channelService.deleteRatePlan(planId);
        return ResponseEntity.noContent().build();
    }
}
