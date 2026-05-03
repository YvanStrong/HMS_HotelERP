package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.HotelStaffUserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/staff-users")
public class HotelStaffController {

    private final HotelStaffUserService hotelStaffUserService;

    public HotelStaffController(HotelStaffUserService hotelStaffUserService) {
        this.hotelStaffUserService = hotelStaffUserService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<ApiDtos.HotelStaffUserRow> list(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return hotelStaffUserService.listStaff(hotelId, hotelHeader);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ApiDtos.HotelStaffUserRow create(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.HotelStaffCreateRequest body) {
        return hotelStaffUserService.createStaff(hotelId, hotelHeader, body);
    }

    @PatchMapping("/{userId}/role")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ApiDtos.HotelStaffUserRow updateRole(
            @PathVariable UUID hotelId,
            @PathVariable UUID userId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.HotelStaffRoleUpdateRequest body) {
        return hotelStaffUserService.updateRole(hotelId, hotelHeader, userId, body);
    }

    @PostMapping("/{userId}/deactivate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ApiDtos.HotelStaffUserRow deactivate(
            @PathVariable UUID hotelId,
            @PathVariable UUID userId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return hotelStaffUserService.setActive(hotelId, hotelHeader, userId, false);
    }

    @PostMapping("/{userId}/reactivate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ApiDtos.HotelStaffUserRow reactivate(
            @PathVariable UUID hotelId,
            @PathVariable UUID userId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return hotelStaffUserService.setActive(hotelId, hotelHeader, userId, true);
    }

    @PostMapping("/{userId}/reset-password")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ApiDtos.HotelStaffUserRow resetPassword(
            @PathVariable UUID hotelId,
            @PathVariable UUID userId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.HotelStaffPasswordResetRequest body) {
        return hotelStaffUserService.resetPassword(hotelId, hotelHeader, userId, body);
    }
}
