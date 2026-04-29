package com.hms.api;

import com.hms.api.dto.FbDtos;
import com.hms.service.FbService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/v1/hotels/{hotelId}/fb")
public class FbController {

    private final FbService fbService;

    public FbController(FbService fbService) {
        this.fbService = fbService;
    }

    @GetMapping("/outlets")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FNB_STAFF')")
    public List<FbDtos.FbOutletListItem> listOutlets(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return fbService.listOutlets(hotelId, hotelHeader);
    }

    @PostMapping("/outlets")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FNB_STAFF')")
    public ResponseEntity<FbDtos.CreateFbOutletResponse> createOutlet(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FbDtos.CreateFbOutletRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fbService.createOutlet(hotelId, hotelHeader, body));
    }

    @PostMapping("/outlets/{outletId}/menu-items")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FNB_STAFF')")
    public ResponseEntity<FbDtos.CreateMenuItemResponse> createMenuItem(
            @PathVariable UUID hotelId,
            @PathVariable UUID outletId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FbDtos.CreateMenuItemRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(fbService.createMenuItem(hotelId, hotelHeader, outletId, body));
    }

    @GetMapping("/outlets/{outletId}/menu")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST')")
    public FbDtos.FbMenuResponse menu(
            @PathVariable UUID hotelId,
            @PathVariable UUID outletId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String dietary,
            @RequestParam(defaultValue = "true") boolean availableOnly) {
        return fbService.menu(hotelId, hotelHeader, outletId, category, dietary, availableOnly);
    }

    @PostMapping("/orders")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST')")
    public ResponseEntity<FbDtos.CreateFbOrderResponse> createOrder(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FbDtos.CreateFbOrderRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fbService.createOrder(hotelId, hotelHeader, body));
    }

    @PatchMapping("/orders/{orderId}/status")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public FbDtos.PatchFbOrderResponse patchOrder(
            @PathVariable UUID hotelId,
            @PathVariable UUID orderId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FbDtos.PatchFbOrderRequest body) {
        return fbService.patchOrder(hotelId, hotelHeader, orderId, body);
    }

    @PostMapping("/orders/{orderId}/charge-to-room")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public FbDtos.ChargeFbOrderToRoomResponse chargeToRoom(
            @PathVariable UUID hotelId,
            @PathVariable UUID orderId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FbDtos.ChargeFbOrderToRoomRequest body) {
        return fbService.chargeOrderToRoom(hotelId, hotelHeader, orderId, body);
    }
}
