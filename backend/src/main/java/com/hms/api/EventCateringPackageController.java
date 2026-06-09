package com.hms.api;

import com.hms.api.dto.EventOpsDtos;
import com.hms.security.CheckModuleEntitlement;
import com.hms.service.EventCateringPackageService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/catering-packages")
@CheckModuleEntitlement("GROUPS_EVENTS")
@RequiredArgsConstructor
public class EventCateringPackageController {

    private final EventCateringPackageService cateringPackageService;

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<EventOpsDtos.CateringPackageResponse> list(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "true") boolean activeOnly) {
        return cateringPackageService.list(hotelId, hotelHeader, activeOnly);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public EventOpsDtos.CateringPackageResponse create(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody EventOpsDtos.CateringPackageRequest body) {
        return cateringPackageService.create(hotelId, hotelHeader, body);
    }

    @PutMapping("/{packageId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public EventOpsDtos.CateringPackageResponse update(
            @PathVariable UUID hotelId,
            @PathVariable UUID packageId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody EventOpsDtos.CateringPackageRequest body) {
        return cateringPackageService.update(hotelId, hotelHeader, packageId, body);
    }
}
