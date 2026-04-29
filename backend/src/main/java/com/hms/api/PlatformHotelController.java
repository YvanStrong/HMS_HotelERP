package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.Hotel;
import com.hms.service.HotelProvisioningService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/hotels")
public class PlatformHotelController {

    private final HotelProvisioningService hotelProvisioningService;

    public PlatformHotelController(HotelProvisioningService hotelProvisioningService) {
        this.hotelProvisioningService = hotelProvisioningService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<ApiDtos.CreateHotelResponse> createHotel(@Valid @RequestBody ApiDtos.HotelCreateInput body) {
        Hotel h = hotelProvisioningService.createHotel(body);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ApiDtos.CreateHotelResponse(
                        h.getId(), h.getCode(), h.getName(), "Hotel created"));
    }

    @PutMapping("/{hotelId}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<ApiDtos.CreateHotelResponse> updateHotel(
            @PathVariable UUID hotelId, @RequestBody ApiDtos.HotelUpdateInput body) {
        Hotel h = hotelProvisioningService.updateHotel(hotelId, body);
        return ResponseEntity.ok(
                new ApiDtos.CreateHotelResponse(h.getId(), h.getCode(), h.getName(), "Hotel updated"));
    }

    @DeleteMapping("/{hotelId}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<Void> deleteHotel(
            @PathVariable UUID hotelId, @RequestParam(name = "purge", defaultValue = "false") boolean purge) {
        hotelProvisioningService.deleteHotel(hotelId, purge);
        return ResponseEntity.noContent().build();
    }
}
