package com.hms.api;

import com.hms.api.dto.ReportDtos;
import com.hms.service.ReportService;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
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
@RequestMapping("/api/v1/hotels/{hotelId}/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/occupancy")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ReportDtos.OccupancyReportResponse occupancy(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate,
            @RequestParam(defaultValue = "day") String groupBy,
            @RequestParam(required = false) String roomType) {
        return reportService.occupancy(hotelId, hotelHeader, startDate, endDate, groupBy, roomType);
    }

    @GetMapping("/occupancy/export")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<byte[]> exportOccupancy(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate,
            @RequestParam(defaultValue = "day") String groupBy,
            @RequestParam(defaultValue = "csv") String format) {
        String f = format == null ? "csv" : format.trim().toLowerCase();
        if ("pdf".equals(f)) {
            byte[] bytes = reportService.exportOccupancyPdf(hotelId, hotelHeader, startDate, endDate, groupBy);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=occupancy-report.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(bytes);
        }
        byte[] bytes = reportService.exportOccupancyCsv(hotelId, hotelHeader, startDate, endDate, groupBy)
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=occupancy-report.csv")
                .contentType(new MediaType("text", "csv"))
                .body(bytes);
    }

    @GetMapping("/guest-analytics")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ReportDtos.GuestAnalyticsResponse guestAnalytics(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String tier,
            @RequestParam(required = false) BigDecimal minSpend) {
        return reportService.guestAnalytics(hotelId, hotelHeader, segment, tier, minSpend);
    }

    @GetMapping("/guest-analytics/export")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<byte[]> exportGuestAnalytics(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String tier,
            @RequestParam(required = false) BigDecimal minSpend,
            @RequestParam(defaultValue = "csv") String format) {
        String f = format == null ? "csv" : format.trim().toLowerCase();
        if ("pdf".equals(f)) {
            byte[] bytes = reportService.exportGuestAnalyticsPdf(hotelId, hotelHeader, segment, tier, minSpend);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=guest-analytics-report.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(bytes);
        }
        byte[] bytes = reportService.exportGuestAnalyticsCsv(hotelId, hotelHeader, segment, tier, minSpend)
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=guest-analytics-report.csv")
                .contentType(new MediaType("text", "csv"))
                .body(bytes);
    }

    @GetMapping("/realtime-dashboard")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ReportDtos.RealtimeDashboardResponse realtime(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reportService.realtime(hotelId, hotelHeader);
    }

    @GetMapping("/executive-dashboard")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ReportDtos.ExecutiveDashboardResponse executive(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reportService.executive(hotelId, hotelHeader);
    }
}
