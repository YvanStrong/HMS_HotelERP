package com.hms.api;

import com.hms.api.dto.PosAnalyticsDtos;
import com.hms.security.CheckModuleEntitlement;
import com.hms.security.PosStaffRoles;
import com.hms.service.PosAnalyticsService;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/pos/analytics")
@CheckModuleEntitlement("RESTAURANT_POS")
@RequiredArgsConstructor
public class PosAnalyticsController {

    private final PosAnalyticsService posAnalyticsService;

    @GetMapping("/summary")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public PosAnalyticsDtos.SummaryResponse summary(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) UUID depotId) {
        return posAnalyticsService.summary(hotelId, hotelHeader, from, to, depotId);
    }

    @GetMapping("/hourly")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public List<PosAnalyticsDtos.HourlySlot> hourly(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate date,
            @RequestParam(required = false) UUID depotId) {
        return posAnalyticsService.hourly(hotelId, hotelHeader, date, depotId);
    }

    @GetMapping("/top-items")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public List<PosAnalyticsDtos.TopItemRow> topItems(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) UUID depotId,
            @RequestParam(defaultValue = "10") int limit) {
        return posAnalyticsService.topItems(hotelId, hotelHeader, from, to, depotId, limit);
    }

    @GetMapping("/waiters")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public List<PosAnalyticsDtos.WaiterRow> waiters(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to) {
        return posAnalyticsService.waiters(hotelId, hotelHeader, from, to);
    }

    @GetMapping("/tables")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public List<PosAnalyticsDtos.TableRow> tables(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) UUID depotId) {
        return posAnalyticsService.tables(hotelId, hotelHeader, from, to, depotId);
    }

    @GetMapping("/daily")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public List<PosAnalyticsDtos.DailyRevenueRow> daily(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) UUID depotId) {
        return posAnalyticsService.dailySeries(hotelId, hotelHeader, from, to, depotId);
    }

    @GetMapping(value = "/export", produces = "text/csv")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public ResponseEntity<String> exportCsv(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) UUID depotId) {
        String csv = posAnalyticsService.exportCsv(hotelId, hotelHeader, from, to, depotId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=pos-tickets.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
