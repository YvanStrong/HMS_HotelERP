package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.RoomManagementService;
import com.hms.service.RoomTypeService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/room-types")
public class RoomTypeController {

    private final RoomTypeService roomTypeService;
    private final RoomManagementService roomManagementService;

    public RoomTypeController(RoomTypeService roomTypeService, RoomManagementService roomManagementService) {
        this.roomTypeService = roomTypeService;
        this.roomManagementService = roomManagementService;
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE','ROLE_FINANCE')")
    public List<ApiDtos.RoomTypeSummary> listRoomTypes(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return roomTypeService.list(hotelId, hotelHeader).stream()
                .map(rt -> new ApiDtos.RoomTypeSummary(
                        rt.getId(), rt.getName(), rt.getBaseRate(), rt.getMaxOccupancy(), rt.getBedCount()))
                .toList();
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<ApiDtos.CreateRoomTypeResponse> createRoomType(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.RoomTypeCreateInput body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(roomTypeService.create(hotelId, hotelHeader, body));
    }

    @GetMapping("/{roomTypeId}/nightly-rates")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.RoomTypeNightlyRateEntry> listNightlyRates(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomTypeId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to) {
        return roomManagementService.listNightlyRates(hotelId, hotelHeader, roomTypeId, from, to);
    }

    @PutMapping("/{roomTypeId}/nightly-rates")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ApiDtos.RoomTypeNightlyRatesUpsertResponse upsertNightlyRates(
            @PathVariable UUID hotelId,
            @PathVariable UUID roomTypeId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.RoomTypeNightlyRatesUpsertRequest body) {
        return roomManagementService.upsertNightlyRates(hotelId, hotelHeader, roomTypeId, body);
    }
}
