package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.GuestDtos;
import com.hms.service.GuestService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/guests")
public class GuestController {

    private final GuestService guestService;

    public GuestController(GuestService guestService) {
        this.guestService = guestService;
    }

    @GetMapping("/search")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<GuestDtos.GuestSearchHit> searchGuests(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam String q) {
        return guestService.searchGuests(hotelId, hotelHeader, q);
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<GuestDtos.GuestSearchHit> listGuests(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.listGuests(hotelId, hotelHeader);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ResponseEntity<GuestDtos.GuestSearchHit> createGuest(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody ApiDtos.GuestInput body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(guestService.createGuestForStaff(hotelId, hotelHeader, body));
    }

    @GetMapping("/{guestId}/profile")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public GuestDtos.GuestProfileResponse profile(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.profile(hotelId, hotelHeader, guestId);
    }

    @PostMapping("/{guestId}/loyalty/earn")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public GuestDtos.LoyaltyEarnResponse earn(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.LoyaltyEarnRequest body) {
        return guestService.earnLoyalty(hotelId, hotelHeader, guestId, body);
    }

    @PostMapping("/{guestId}/loyalty/redeem")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE','ROLE_GUEST')")
    public GuestDtos.LoyaltyRedeemResponse redeem(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.LoyaltyRedeemRequest body) {
        return guestService.redeemLoyalty(hotelId, hotelHeader, guestId, body);
    }
}
