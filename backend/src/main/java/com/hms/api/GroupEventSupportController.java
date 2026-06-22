package com.hms.api;

import com.hms.api.dto.EventOpsDtos;
import com.hms.security.CheckModuleEntitlement;
import com.hms.service.EventBillingService;
import com.hms.service.EventBookingService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/groups")
@CheckModuleEntitlement("GROUPS_EVENTS")
@RequiredArgsConstructor
public class GroupEventSupportController {

    private final EventBookingService eventBookingService;
    private final EventBillingService eventBillingService;

    @GetMapping("/venues")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<EventOpsDtos.VenueOption> listVenues(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBookingService.listVenues(hotelId, hotelHeader);
    }

    @GetMapping("/depot-products")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<EventOpsDtos.DepotProductOption> listDepotProducts(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBookingService.listDepotProducts(hotelId, hotelHeader);
    }

    @GetMapping("/events/upcoming")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<EventOpsDtos.EventListItem> listUpcomingEvents(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBookingService.listUpcomingForHotel(hotelId, hotelHeader);
    }

    @GetMapping("/{groupId}/event-billing-summary")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public EventOpsDtos.EventBillingSummaryResponse billingSummary(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBillingService.getEventBillingSummary(hotelId, hotelHeader, groupId);
    }
}
