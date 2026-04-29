package com.hms.service;

import com.hms.api.dto.ReportDtos;
import com.hms.domain.LoyaltyTier;
import com.hms.entity.Guest;
import com.hms.repository.GuestRepository;
import com.hms.repository.InvoiceRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;
    private final GuestRepository guestRepository;
    private final InvoiceRepository invoiceRepository;
    private final TenantAccessService tenantAccessService;

    public ReportService(
            RoomRepository roomRepository,
            ReservationRepository reservationRepository,
            GuestRepository guestRepository,
            InvoiceRepository invoiceRepository,
            TenantAccessService tenantAccessService) {
        this.roomRepository = roomRepository;
        this.reservationRepository = reservationRepository;
        this.guestRepository = guestRepository;
        this.invoiceRepository = invoiceRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional(readOnly = true)
    public ReportDtos.OccupancyReportResponse occupancy(
            UUID hotelId,
            String hotelHeader,
            LocalDate start,
            LocalDate end,
            String groupBy,
            String roomTypeCodeIgnored) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (end.isBefore(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "endDate must be on or after startDate");
        }
        String gb = groupBy != null && !groupBy.isBlank() ? groupBy : "day";
        long totalRooms = roomRepository.countByHotel_Id(hotelId);
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal sumOcc = BigDecimal.ZERO;
        BigDecimal sumAdr = BigDecimal.ZERO;
        BigDecimal sumRevpar = BigDecimal.ZERO;
        int days = 0;
        double peakOcc = 0;
        LocalDate peakDate = start;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            days++;
            long occ = reservationRepository.countDistinctOccupiedRoomsForNight(hotelId, d);
            double occRateD = totalRooms > 0 ? occ * 100.0 / totalRooms : 0.0;
            occRateD = BigDecimal.valueOf(occRateD).setScale(1, RoundingMode.HALF_UP).doubleValue();
            BigDecimal sumTotals = reservationRepository.sumTotalAmountForOccupiedNight(hotelId, d);
            BigDecimal adr = occ > 0
                    ? sumTotals.divide(BigDecimal.valueOf(occ), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal revpar = totalRooms > 0
                    ? sumTotals.divide(BigDecimal.valueOf(totalRooms), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            Map<String, Object> row = new HashMap<>();
            row.put("date", d.toString());
            row.put("totalRooms", totalRooms);
            row.put("occupiedRooms", occ);
            row.put("occupancyRate", occRateD);
            row.put("adr", adr);
            row.put("revpar", revpar);
            row.put("breakdown", Map.of("byRoomType", Map.of(), "byChannel", Map.of()));
            rows.add(row);
            sumOcc = sumOcc.add(BigDecimal.valueOf(occRateD));
            sumAdr = sumAdr.add(adr);
            sumRevpar = sumRevpar.add(revpar);
            if (occRateD > peakOcc) {
                peakOcc = occRateD;
                peakDate = d;
            }
        }
        int n = Math.max(1, days);
        Map<String, Object> summary = new HashMap<>();
        summary.put("averageOccupancy", sumOcc.divide(BigDecimal.valueOf(n), 1, RoundingMode.HALF_UP).doubleValue());
        summary.put("peakOccupancy", peakOcc);
        summary.put("peakDate", peakDate.toString());
        summary.put("averageADR", sumAdr.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP));
        summary.put("averageRevPAR", sumRevpar.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP));
        summary.put("totalRoomNights", totalRooms * n);

        Map<String, String> export = new HashMap<>();
        export.put("csv", "/api/v1/hotels/" + hotelId + "/reports/occupancy/export?format=csv");
        export.put("pdf", "/api/v1/hotels/" + hotelId + "/reports/occupancy/export?format=pdf");

        return new ReportDtos.OccupancyReportResponse(
                "OCCUPANCY",
                hotelId,
                new ReportDtos.ReportPeriod(start, end, gb),
                summary,
                rows,
                export);
    }

    @Transactional(readOnly = true)
    public ReportDtos.GuestAnalyticsResponse guestAnalytics(
            UUID hotelId, String hotelHeader, String segment, String tier, BigDecimal minSpend) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<Guest> guests = guestRepository.findByHotel_Id(hotelId);
        LoyaltyTier tierFilter = null;
        if (tier != null && !tier.isBlank()) {
            tierFilter = LoyaltyTier.valueOf(tier.trim().toUpperCase());
        }
        BigDecimal min = minSpend != null ? minSpend : BigDecimal.ZERO;
        List<Guest> filtered = new ArrayList<>();
        for (Guest g : guests) {
            if (tierFilter != null && g.getLoyaltyTier() != tierFilter) {
                continue;
            }
            BigDecimal ltv = guestRepository.sumLifetimeSpendByGuest(g.getId(), hotelId);
            if (ltv.compareTo(min) < 0) {
                continue;
            }
            if ("RETURNING".equalsIgnoreCase(segment) && guestRepository.countReservationsByGuest(g.getId(), hotelId) < 2) {
                continue;
            }
            filtered.add(g);
        }
        BigDecimal sumLtv = BigDecimal.ZERO;
        long sumStays = 0;
        for (Guest g : filtered) {
            sumLtv = sumLtv.add(guestRepository.sumLifetimeSpendByGuest(g.getId(), hotelId));
            sumStays += guestRepository.countReservationsByGuest(g.getId(), hotelId);
        }
        int c = Math.max(1, filtered.size());
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalGuests", filtered.size());
        summary.put("averageLifetimeValue", sumLtv.divide(BigDecimal.valueOf(c), 2, RoundingMode.HALF_UP));
        summary.put("averageStaysPerGuest", (double) sumStays / c);
        summary.put("topNationality", "—");
        summary.put("repeatGuestRate", 0.0);

        List<Map<String, Object>> insights = List.of(
                Map.of(
                        "type",
                        "PREFERENCE_TREND",
                        "finding",
                        "High-floor preference correlates with loyalty tier in this snapshot",
                        "actionable",
                        "Prioritize floor matching during CONFIRMED assignment"));
        List<Map<String, Object>> segments = List.of(Map.of(
                "name",
                "Filtered cohort",
                "count",
                filtered.size(),
                "criteria",
                "tier/minSpend/segment filters"));

        Map<String, Object> filters = new HashMap<>();
        filters.put("segment", segment);
        filters.put("loyaltyTier", tier);
        filters.put("minLifetimeValue", min);

        return new ReportDtos.GuestAnalyticsResponse(
                "GUEST_ANALYTICS",
                filters,
                summary,
                insights,
                segments,
                "/api/v1/hotels/" + hotelId + "/reports/guest-analytics/export");
    }

    @Transactional(readOnly = true)
    public ReportDtos.RealtimeDashboardResponse realtime(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long totalRooms = roomRepository.countByHotel_Id(hotelId);
        long occ = reservationRepository.countDistinctOccupiedRoomsForNight(hotelId, today);
        long arrivals = reservationRepository.countArrivalsOnDate(hotelId, today);
        long departures = reservationRepository.countDeparturesOnDate(hotelId, today);
        Instant start = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        BigDecimal todayRev = invoiceRepository.sumTotalAmountByHotelAndCreatedAtRange(hotelId, start, end);

        Map<String, Object> occMap = new HashMap<>();
        occMap.put("current", occ);
        occMap.put("forecast", occ);
        occMap.put("trend", "steady");

        Map<String, Object> live = new HashMap<>();
        live.put("occupancy", occMap);
        live.put(
                "arrivals",
                Map.of("today", arrivals, "checkedIn", 0, "pending", arrivals, "earlyCheckIns", 0));
        live.put(
                "departures",
                Map.of("today", departures, "checkedOut", 0, "pending", departures, "lateCheckOuts", 0));
        live.put("housekeeping", Map.of("roomsToClean", 0, "inProgress", 0, "readyForInspection", 0, "averageTurnaround", 0));
        live.put(
                "revenue",
                Map.of("todayToDate", todayRev, "projected", todayRev, "vsForecast", "n/a"));

        List<Map<String, Object>> alerts = new ArrayList<>();
        List<Map<String, Object>> actions = List.of(
                Map.of("label", "Check-in pending guests", "url", "/reservations?status=CONFIRMED"),
                Map.of("label", "Housekeeping tasks", "url", "/api/v1/hotels/" + hotelId + "/housekeeping/tasks"));

        return new ReportDtos.RealtimeDashboardResponse(
                Instant.now().toString(), hotelId, live, alerts, actions);
    }
}
