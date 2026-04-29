package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.ChargeService;
import com.hms.service.RoomManagementService;
import com.hms.service.RoomService;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/rooms")
public class RoomController {

    private final RoomService roomService;
    private final ChargeService chargeService;
    private final TenantAccessService tenantAccessService;
    private final RoomManagementService roomManagementService;

    public RoomController(
            RoomService roomService,
            ChargeService chargeService,
            TenantAccessService tenantAccessService,
            RoomManagementService roomManagementService) {
        this.roomService = roomService;
        this.chargeService = chargeService;
        this.tenantAccessService = tenantAccessService;
        this.roomManagementService = roomManagementService;
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE','ROLE_FINANCE','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.PagedData<ApiDtos.RoomListItem> listRooms(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer floor,
            @RequestParam(required = false) String roomType) {
        return roomService.listRooms(hotelId, hotelHeader, page, size, status, floor, roomType);
    }

    @GetMapping("/dashboard")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE','ROLE_FINANCE','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.RoomDashboardResponse roomDashboard(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return roomManagementService.dashboard(hotelId, hotelHeader);
    }

    @GetMapping("/summary")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE','ROLE_FINANCE','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.RoomStatusSummary roomStatusSummary(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return roomService.roomStatusSummary(hotelId, hotelHeader);
    }

    @GetMapping("/availability")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.RoomTypesAvailabilityResponse roomTypesAvailability(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam("check_in") LocalDate checkIn,
            @RequestParam("check_out") LocalDate checkOut,
            @RequestParam(value = "room_type_id", required = false) UUID roomTypeId,
            @RequestParam(defaultValue = "2") int adults) {
        return roomService.roomTypesAvailability(hotelId, hotelHeader, checkIn, checkOut, roomTypeId, adults);
    }

    @GetMapping("/occupancy-grid")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.RoomOccupancyGridResponse occupancyGrid(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to) {
        return roomManagementService.occupancyGrid(hotelId, hotelHeader, from, to);
    }

    @GetMapping("/blocks")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public List<ApiDtos.RoomBlockResponse> listRoomBlocks(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate rangeStart,
            @RequestParam LocalDate rangeEnd) {
        return roomManagementService.listBlocks(hotelId, hotelHeader, rangeStart, rangeEnd);
    }

    @PostMapping("/blocks")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<ApiDtos.RoomBlockResponse> createRoomBlock(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.RoomBlockCreateRequest body) {
        UserPrincipal user = tenantAccessService.currentUser();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(roomManagementService.createBlock(hotelId, hotelHeader, body, user.getUsername()));
    }

    @PostMapping("/blocks/{blockId}/release")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ApiDtos.RoomBlockResponse releaseRoomBlock(
            @PathVariable UUID hotelId,
            @PathVariable UUID blockId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        UserPrincipal user = tenantAccessService.currentUser();
        return roomManagementService.releaseBlock(hotelId, hotelHeader, blockId, user.getUsername());
    }

    @GetMapping("/{roomId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE','ROLE_FINANCE','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.RoomDetailResponse getRoom(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return roomService.getRoom(hotelId, hotelHeader, roomId);
    }

    @GetMapping("/{roomId}/status-history")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE','ROLE_FINANCE','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public List<ApiDtos.RoomStatusLogEntry> roomStatusHistory(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "50") int limit) {
        return roomManagementService.statusHistory(hotelId, hotelHeader, roomId, limit);
    }

    @PostMapping("/{roomId}/blocks")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ResponseEntity<ApiDtos.RoomBlockResponse> createOperationalRoomBlock(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.RoomOperationalBlockRequest body) {
        UserPrincipal user = tenantAccessService.currentUser();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(roomManagementService.createOperationalRoomBlock(
                        hotelId, hotelHeader, roomId, body, user.getUsername()));
    }

    @DeleteMapping("/{roomId}/blocks")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ApiDtos.RoomBlockResponse releaseOperationalRoomBlock(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        UserPrincipal user = tenantAccessService.currentUser();
        return roomManagementService.releaseOperationalRoomBlock(hotelId, hotelHeader, roomId, user.getUsername());
    }

    @PatchMapping("/{roomId}/dnd")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.RoomDndResponse patchRoomDnd(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.RoomDndPatchRequest body) {
        UserPrincipal user = tenantAccessService.currentUser();
        return roomManagementService.patchDnd(
                hotelId, hotelHeader, roomId, body, user.getUsername(), user.getId());
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<ApiDtos.CreateRoomResponse> createRoom(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.CreateRoomRequest request) {
        UserPrincipal user = tenantAccessService.currentUser();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(roomService.createRoom(hotelId, hotelHeader, request, user.getUsername()));
    }

    @PatchMapping("/{roomId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_MAINTENANCE','ROLE_RECEPTIONIST')")
    public ApiDtos.PatchRoomResponse patchRoom(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.PatchRoomRequest request) {
        UserPrincipal user = tenantAccessService.currentUser();
        return roomService.patchRoom(hotelId, hotelHeader, roomId, request, user.getUsername());
    }

    @DeleteMapping("/{roomId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<ApiDtos.DeleteRoomResponse> deleteRoom(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return ResponseEntity.ok(roomService.softDeleteRoom(hotelId, hotelHeader, roomId));
    }

    @PatchMapping("/{roomId}/status")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingPatchResponse patchRoomStatus(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.HousekeepingPatchRequest request) {
        return roomService.patchHousekeepingStatus(hotelId, hotelHeader, roomId, request);
    }

    @PostMapping("/{roomId}/charges")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FNB_STAFF')")
    public ResponseEntity<ApiDtos.PostChargeResponse> postCharge(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.PostChargeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(chargeService.postCharge(hotelId, hotelHeader, roomId, request));
    }
}
