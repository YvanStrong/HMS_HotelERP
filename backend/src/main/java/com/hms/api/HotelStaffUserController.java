package com.hms.api;

import com.hms.api.dto.StaffDtos;
import com.hms.entity.AppUser;
import com.hms.security.TenantAccessService;
import com.hms.service.PlatformStaffUserService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/staff")
public class HotelStaffUserController {

    private final PlatformStaffUserService platformStaffUserService;
    private final TenantAccessService tenantAccessService;

    public HotelStaffUserController(
            PlatformStaffUserService platformStaffUserService, TenantAccessService tenantAccessService) {
        this.platformStaffUserService = platformStaffUserService;
        this.tenantAccessService = tenantAccessService;
    }

    @PostMapping("/users")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<StaffDtos.StaffUserResponse> createStaffUser(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody StaffDtos.CreateHotelStaffUserRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        AppUser created = platformStaffUserService.createHotelScopedUserReturning(
                hotelId, body.username(), body.password(), body.email(), body.role());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new StaffDtos.StaffUserResponse(
                        created.getId().toString(),
                        created.getUsername(),
                        created.getEmail(),
                        created.getRole().name(),
                        created.getHotel() != null ? created.getHotel().getId().toString() : hotelId.toString()));
    }
}
