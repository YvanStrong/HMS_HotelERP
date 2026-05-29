package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.GroupBooking;
import com.hms.entity.Reservation;
import com.hms.service.GroupBookingService;
import com.hms.security.CheckModuleEntitlement;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/groups")
@CheckModuleEntitlement("GROUPS_EVENTS")
@RequiredArgsConstructor
public class GroupController {

    private final GroupBookingService groupBookingService;

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<GroupBooking> listGroups(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return groupBookingService.listGroups(hotelId, hotelHeader);
    }

    @GetMapping("/{groupId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public GroupBooking getGroup(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return groupBookingService.getGroup(hotelId, hotelHeader, groupId);
    }

    @DeleteMapping("/{groupId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public void deleteGroup(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        groupBookingService.deleteGroup(hotelId, hotelHeader, groupId);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public GroupBooking createGroup(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody GroupBooking group) {
        return groupBookingService.createGroup(hotelId, hotelHeader, group);
    }

    @PatchMapping("/{groupId}/billing")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public void patchBilling(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.GroupBillingPatchRequest body) {
        groupBookingService.patchBilling(hotelId, hotelHeader, groupId, body);
    }

    @GetMapping("/{groupId}/billing-dashboard")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.GroupBillingDashboardResponse billingDashboard(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return groupBookingService.getBillingDashboard(hotelId, hotelHeader, groupId);
    }

    @GetMapping("/{groupId}/rooming-list")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<Reservation> getRoomingList(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return groupBookingService.getRoomingList(hotelId, hotelHeader, groupId);
    }

    @PostMapping("/{groupId}/reservations/{reservationId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public void addReservationToGroup(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID reservationId) {
        groupBookingService.addReservationToGroup(hotelId, groupId, reservationId);
    }

    @PostMapping("/{groupId}/reserve-block")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ApiDtos.GroupBlockReserveResponse reserveBlock(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.GroupBlockReserveRequest body) {
        return groupBookingService.reserveBlock(hotelId, hotelHeader, groupId, body);
    }
}
