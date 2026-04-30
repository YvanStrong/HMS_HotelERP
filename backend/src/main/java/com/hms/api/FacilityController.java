package com.hms.api;

import com.hms.api.dto.FacilityDtos;
import com.hms.service.FacilityService;
import jakarta.validation.Valid;
import java.time.LocalDate;
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
@RequestMapping("/api/v1/hotels/{hotelId}/facilities")
public class FacilityController {

    private final FacilityService facilityService;

    public FacilityController(FacilityService facilityService) {
        this.facilityService = facilityService;
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST','ROLE_CORPORATE_BOOKER')")
    public List<FacilityDtos.FacilitySummary> listFacilities(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return facilityService.listFacilities(hotelId, hotelHeader);
    }

    @GetMapping("/{facilityId}/dashboard")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST','ROLE_CORPORATE_BOOKER')")
    public FacilityDtos.FacilityDashboardResponse dashboard(
            @PathVariable UUID hotelId,
            @PathVariable UUID facilityId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        return facilityService.dashboard(hotelId, hotelHeader, facilityId, fromDate, toDate);
    }

    @GetMapping("/{facilityId}/maintenances")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE')")
    public List<FacilityDtos.FacilityMaintenanceListItem> listMaintenance(
            @PathVariable UUID hotelId,
            @PathVariable UUID facilityId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return facilityService.listMaintenance(hotelId, hotelHeader, facilityId);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<FacilityDtos.FacilityCreatedResponse> createFacility(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FacilityDtos.FacilityCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(facilityService.createFacility(hotelId, hotelHeader, body));
    }

    @PostMapping("/{facilityId}/slots")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<FacilityDtos.FacilitySlotResponse> createSlot(
            @PathVariable UUID hotelId,
            @PathVariable UUID facilityId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FacilityDtos.FacilitySlotCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(facilityService.createSlot(hotelId, hotelHeader, facilityId, body));
    }

    @PostMapping("/{facilityId}/bookings")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST','ROLE_CORPORATE_BOOKER')")
    public ResponseEntity<FacilityDtos.FacilityBookingResponse> createBooking(
            @PathVariable UUID hotelId,
            @PathVariable UUID facilityId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FacilityDtos.FacilityBookingRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(facilityService.createBooking(hotelId, hotelHeader, facilityId, body));
    }

    @PostMapping("/bookings/{bookingId}/check-in")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_MAINTENANCE')")
    public FacilityDtos.FacilityCheckInResponse checkIn(
            @PathVariable UUID hotelId,
            @PathVariable UUID bookingId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FacilityDtos.FacilityCheckInRequest body) {
        return facilityService.checkInBooking(hotelId, hotelHeader, bookingId, body);
    }

    @PostMapping("/bookings/{bookingId}/charge-to-room")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public FacilityDtos.ChargeFacilityToRoomResponse chargeToRoom(
            @PathVariable UUID hotelId,
            @PathVariable UUID bookingId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) FacilityDtos.ChargeFacilityToRoomRequest body) {
        FacilityDtos.ChargeFacilityToRoomRequest req =
                body != null ? body : new FacilityDtos.ChargeFacilityToRoomRequest(null);
        return facilityService.chargeToRoom(hotelId, hotelHeader, bookingId, req);
    }

    @PostMapping("/bookings/{bookingId}/cancel")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST','ROLE_CORPORATE_BOOKER')")
    public ResponseEntity<Void> cancelBooking(
            @PathVariable UUID hotelId,
            @PathVariable UUID bookingId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        facilityService.cancelBooking(hotelId, hotelHeader, bookingId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{facilityId}/maintenance")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_MAINTENANCE')")
    public FacilityDtos.FacilityMaintenanceResponse maintenance(
            @PathVariable UUID hotelId,
            @PathVariable UUID facilityId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody FacilityDtos.FacilityMaintenanceRequest body) {
        return facilityService.reportMaintenance(hotelId, hotelHeader, facilityId, body);
    }
}
