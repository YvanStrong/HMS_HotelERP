package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.GuestPortalService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/guest-portal")
public class GuestPortalController {

    private final GuestPortalService guestPortalService;

    public GuestPortalController(GuestPortalService guestPortalService) {
        this.guestPortalService = guestPortalService;
    }

    @GetMapping("/bookings")
    @PreAuthorize("hasAuthority('ROLE_GUEST')")
    public List<ApiDtos.GuestBookingRow> myBookings(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestPortalService.myBookings(hotelId, hotelHeader);
    }
}
