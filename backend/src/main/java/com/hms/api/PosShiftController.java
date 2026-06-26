package com.hms.api;

import com.hms.api.dto.PosShiftDtos;
import com.hms.domain.ShiftStatus;
import com.hms.security.CheckModuleEntitlement;
import com.hms.security.PosStaffRoles;
import com.hms.security.TenantAccessService;
import com.hms.service.PosShiftService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
@RequestMapping("/api/v1/hotels/{hotelId}/pos/shifts")
@CheckModuleEntitlement("RESTAURANT_POS")
@RequiredArgsConstructor
public class PosShiftController {

    private final PosShiftService posShiftService;
    private final TenantAccessService tenantAccessService;

    @PostMapping
    @PreAuthorize(PosStaffRoles.SHIFT_WAITER)
    public PosShiftDtos.PosShiftDTO openShift(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody PosShiftDtos.OpenShiftRequest req) {
        UUID waiterId = tenantAccessService.currentUser().getId();
        return posShiftService.openShift(hotelId, hotelHeader, req.depotId(), waiterId, req);
    }

    @GetMapping("/active")
    @PreAuthorize(PosStaffRoles.SHIFT_WAITER)
    public ResponseEntity<PosShiftDtos.PosShiftDTO> getActiveShift(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        UUID waiterId = tenantAccessService.currentUser().getId();
        return posShiftService
                .getActiveShift(hotelId, hotelHeader, waiterId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/{shiftId}/summary")
    @PreAuthorize(PosStaffRoles.SHIFT_STAFF)
    public PosShiftDtos.PosShiftSummaryDTO getShiftSummary(
            @PathVariable UUID hotelId,
            @PathVariable UUID shiftId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posShiftService.getShiftSummary(hotelId, hotelHeader, shiftId);
    }

    @PostMapping("/{shiftId}/close")
    @PreAuthorize(PosStaffRoles.SHIFT_STAFF)
    public PosShiftDtos.PosShiftSummaryDTO closeShift(
            @PathVariable UUID hotelId,
            @PathVariable UUID shiftId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody PosShiftDtos.CloseShiftRequest req) {
        UUID closedBy = tenantAccessService.currentUser().getId();
        return posShiftService.closeShift(hotelId, hotelHeader, shiftId, req, closedBy);
    }

    @GetMapping
    @PreAuthorize(PosStaffRoles.MANAGER)
    public Page<PosShiftDtos.PosShiftDTO> getShiftHistory(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId,
            @RequestParam(required = false) UUID waiterId,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) ShiftStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return posShiftService.getShiftHistory(
                hotelId,
                hotelHeader,
                depotId,
                waiterId,
                from,
                to,
                status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "openedAt")));
    }

    @GetMapping("/open")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public List<PosShiftDtos.PosShiftDTO> getAllOpenShifts(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId) {
        return posShiftService.getAllOpenShifts(hotelId, hotelHeader, depotId);
    }

    @GetMapping("/{shiftId}")
    @PreAuthorize(PosStaffRoles.SHIFT_STAFF)
    public PosShiftDtos.PosShiftSummaryDTO getShift(
            @PathVariable UUID hotelId,
            @PathVariable UUID shiftId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posShiftService.getShift(hotelId, hotelHeader, shiftId);
    }

    @GetMapping("/{shiftId}/export")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public ResponseEntity<String> exportShift(
            @PathVariable UUID hotelId,
            @PathVariable UUID shiftId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "csv") String format) {
        if (!"csv".equalsIgnoreCase(format)) {
            return ResponseEntity.badRequest().body("Only format=csv is supported");
        }
        PosShiftDtos.PosShiftSummaryDTO summary = posShiftService.getShiftSummary(hotelId, hotelHeader, shiftId);
        String body = posShiftService.shiftCsvHeader() + "\n" + posShiftService.exportShiftCsv(summary);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=shift-" + shiftId + ".csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(body);
    }

    @GetMapping("/export")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public ResponseEntity<String> exportBulk(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) UUID depotId,
            @RequestParam(defaultValue = "csv") String format) {
        if (!"csv".equalsIgnoreCase(format)) {
            return ResponseEntity.badRequest().body("Only format=csv is supported");
        }
        Page<PosShiftDtos.PosShiftDTO> page =
                posShiftService.getShiftHistory(hotelId, hotelHeader, depotId, null, from, to, null, PageRequest.of(0, 5000));
        StringBuilder sb = new StringBuilder(posShiftService.shiftCsvHeader()).append('\n');
        for (PosShiftDtos.PosShiftDTO row : page.getContent()) {
            PosShiftDtos.PosShiftSummaryDTO summary =
                    posShiftService.getShiftSummary(hotelId, hotelHeader, row.id());
            sb.append(posShiftService.exportShiftCsv(summary)).append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=shifts-export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(sb.toString());
    }
}
