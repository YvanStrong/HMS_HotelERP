package com.hms.api;

import com.hms.api.dto.DutyDtos;
import com.hms.service.DutyRosterService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/duty")
public class DutyRosterController {

    private static final String OPS =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')";

    private final DutyRosterService dutyRosterService;

    public DutyRosterController(DutyRosterService dutyRosterService) {
        this.dutyRosterService = dutyRosterService;
    }

    @GetMapping
    @PreAuthorize(OPS)
    public List<DutyDtos.DutyShiftRow> list(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String shift,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID userId) {
        return dutyRosterService.list(hotelId, hotelHeader, from, to, shift, status, userId);
    }

    @GetMapping("/summary")
    @PreAuthorize(OPS)
    public DutyDtos.DutySummary summary(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dutyRosterService.summary(hotelId, hotelHeader, date);
    }

    @PostMapping
    @PreAuthorize(OPS)
    public ResponseEntity<DutyDtos.DutyShiftRow> create(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody DutyDtos.CreateDutyShiftRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dutyRosterService.create(hotelId, hotelHeader, body));
    }

    @PutMapping("/{dutyId}")
    @PreAuthorize(OPS)
    public DutyDtos.DutyShiftRow update(
            @PathVariable UUID hotelId,
            @PathVariable UUID dutyId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody DutyDtos.UpdateDutyShiftRequest body) {
        return dutyRosterService.update(hotelId, hotelHeader, dutyId, body);
    }

    @PostMapping("/{dutyId}/status")
    @PreAuthorize(OPS)
    public DutyDtos.DutyShiftRow updateStatus(
            @PathVariable UUID hotelId,
            @PathVariable UUID dutyId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody DutyDtos.UpdateDutyStatusRequest body) {
        return dutyRosterService.updateStatus(hotelId, hotelHeader, dutyId, body);
    }
}
