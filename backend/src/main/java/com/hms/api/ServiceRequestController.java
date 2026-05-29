package com.hms.api;

import com.hms.entity.ServiceRequest;
import com.hms.service.ServiceRequestService;
import com.hms.security.CheckModuleEntitlement;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Guest service request endpoints (in-stay requests from mobile/PWA).
 */
@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/service-requests")
@CheckModuleEntitlement("SERVICE_REQUESTS")
public class ServiceRequestController {

    private final ServiceRequestService service;

    public ServiceRequestController(ServiceRequestService service) {
        this.service = service;
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_HOUSEKEEPING')")
    public List<ServiceRequest> listPending(@PathVariable UUID hotelId) {
        return service.listPending(hotelId);
    }

    @GetMapping("/reservation/{reservationId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST')")
    public List<ServiceRequest> listByReservation(
            @PathVariable UUID hotelId, @PathVariable UUID reservationId) {
        return service.listByReservation(reservationId);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST')")
    public ResponseEntity<ServiceRequest> create(
            @PathVariable UUID hotelId,
            @RequestBody ServiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(hotelId, request));
    }

    @PatchMapping("/{requestId}/status")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_HOUSEKEEPING')")
    public ServiceRequest updateStatus(
            @PathVariable UUID hotelId,
            @PathVariable UUID requestId,
            @RequestBody Map<String, Object> body) {
        String newStatus = body.getOrDefault("status", "COMPLETED").toString();
        UUID assignedTo = body.containsKey("assignedTo") ? UUID.fromString(body.get("assignedTo").toString()) : null;
        return service.updateStatus(requestId, newStatus, assignedTo);
    }
}
