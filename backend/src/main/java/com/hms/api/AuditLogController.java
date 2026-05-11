package com.hms.api;

import com.hms.entity.HotelAuditLog;
import com.hms.repository.HotelAuditLogRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Hotel-level audit log query endpoints.
 */
@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/audit-logs")
public class AuditLogController {

    private final HotelAuditLogRepository auditRepo;

    public AuditLogController(HotelAuditLogRepository auditRepo) {
        this.auditRepo = auditRepo;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public Page<HotelAuditLog> list(
            @PathVariable UUID hotelId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        PageRequest pr = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        if (action != null && !action.isBlank()) {
            return auditRepo.findByHotel_IdAndActionOrderByCreatedAtDesc(hotelId, action, pr);
        }
        if (from != null && to != null) {
            return auditRepo.findByHotel_IdAndCreatedAtBetweenOrderByCreatedAtDesc(hotelId, from, to, pr);
        }
        return auditRepo.findByHotel_IdOrderByCreatedAtDesc(hotelId, pr);
    }
}
