package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.NightAuditService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/night-audit")
public class NightAuditController {

    private final NightAuditService nightAuditService;

    public NightAuditController(NightAuditService nightAuditService) {
        this.nightAuditService = nightAuditService;
    }

    @PostMapping("/run")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_FINANCE','ROLE_MANAGER','ROLE_HOTEL_ADMIN')")
    public ApiDtos.NightAuditRunResponse runNow(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return nightAuditService.runNightAuditNow(hotelId, hotelHeader);
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_FINANCE','ROLE_MANAGER','ROLE_HOTEL_ADMIN')")
    public List<ApiDtos.NightAuditRunResponse> history(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return nightAuditService.history(hotelId, hotelHeader);
    }
}
