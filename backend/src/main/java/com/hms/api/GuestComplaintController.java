package com.hms.api;

import com.hms.api.dto.GuestDtos;
import com.hms.domain.GuestComplaintSeverity;
import com.hms.domain.GuestComplaintStatus;
import com.hms.service.GuestComplaintService;
import com.hms.web.ApiException;
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
@RequestMapping("/api/v1/hotels/{hotelId}/complaints")
public class GuestComplaintController {

    private final GuestComplaintService guestComplaintService;

    public GuestComplaintController(GuestComplaintService guestComplaintService) {
        this.guestComplaintService = guestComplaintService;
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<GuestDtos.OperationalComplaintRow> create(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.OperationalComplaintCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(guestComplaintService.create(hotelId, hotelHeader, body));
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<GuestDtos.OperationalComplaintRow> list(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(defaultValue = "200") int limit) {
        GuestComplaintStatus st = null;
        if (status != null && !status.isBlank()) {
            try {
                st = GuestComplaintStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid status filter");
            }
        }
        GuestComplaintSeverity sev = null;
        if (severity != null && !severity.isBlank()) {
            try {
                sev = GuestComplaintSeverity.valueOf(severity.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid severity filter");
            }
        }
        return guestComplaintService.list(hotelId, hotelHeader, st, sev, limit);
    }

    @GetMapping("/{id}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public GuestDtos.OperationalComplaintRow get(
            @PathVariable UUID hotelId,
            @PathVariable UUID id,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestComplaintService.get(hotelId, hotelHeader, id);
    }

    @PatchMapping("/{id}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public GuestDtos.OperationalComplaintRow patch(
            @PathVariable UUID hotelId,
            @PathVariable UUID id,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.OperationalComplaintPatchRequest body) {
        return guestComplaintService.patch(hotelId, hotelHeader, id, body);
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public GuestDtos.OperationalComplaintRow assign(
            @PathVariable UUID hotelId,
            @PathVariable UUID id,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.OperationalComplaintAssignRequest body) {
        return guestComplaintService.assign(hotelId, hotelHeader, id, body);
    }
}
