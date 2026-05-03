package com.hms.service;

import com.hms.api.dto.ReportDtos;
import com.hms.domain.FolioStatus;
import com.hms.domain.HousekeepingTaskStatus;
import com.hms.domain.LoyaltyTier;
import com.hms.domain.ReservationStatus;
import com.hms.domain.RoomStatus;
import com.hms.entity.Guest;
import com.hms.entity.Payment;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.GuestRepository;
import com.hms.repository.HousekeepingTaskRepository;
import com.hms.repository.InvoiceRepository;
import com.hms.repository.PaymentRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomChargeRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.io.ByteArrayOutputStream;
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
import java.util.stream.Stream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;
    private final GuestRepository guestRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final RoomChargeRepository roomChargeRepository;
    private final HousekeepingTaskRepository housekeepingTaskRepository;
    private final TenantAccessService tenantAccessService;

    public ReportService(
            RoomRepository roomRepository,
            ReservationRepository reservationRepository,
            GuestRepository guestRepository,
            InvoiceRepository invoiceRepository,
            PaymentRepository paymentRepository,
            RoomChargeRepository roomChargeRepository,
            HousekeepingTaskRepository housekeepingTaskRepository,
            TenantAccessService tenantAccessService) {
        this.roomRepository = roomRepository;
        this.reservationRepository = reservationRepository;
        this.guestRepository = guestRepository;
        this.invoiceRepository = invoiceRepository;
        this.paymentRepository = paymentRepository;
        this.roomChargeRepository = roomChargeRepository;
        this.housekeepingTaskRepository = housekeepingTaskRepository;
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
    public String exportOccupancyCsv(
            UUID hotelId, String hotelHeader, LocalDate start, LocalDate end, String groupBy) {
        ReportDtos.OccupancyReportResponse report = occupancy(hotelId, hotelHeader, start, end, groupBy, null);
        StringBuilder csv = new StringBuilder();
        csv.append("date,totalRooms,occupiedRooms,occupancyRate,adr,revpar\n");
        for (Map<String, Object> row : report.data()) {
            csv.append(val(row.get("date"))).append(',')
                    .append(val(row.get("totalRooms"))).append(',')
                    .append(val(row.get("occupiedRooms"))).append(',')
                    .append(val(row.get("occupancyRate"))).append(',')
                    .append(val(row.get("adr"))).append(',')
                    .append(val(row.get("revpar"))).append('\n');
        }
        return csv.toString();
    }

    @Transactional(readOnly = true)
    public byte[] exportOccupancyPdf(
            UUID hotelId, String hotelHeader, LocalDate start, LocalDate end, String groupBy) {
        ReportDtos.OccupancyReportResponse report = occupancy(hotelId, hotelHeader, start, end, groupBy, null);
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(doc, page)) {
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 14);
                content.newLineAtOffset(50, 760);
                content.showText("Occupancy Report");
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
                content.newLineAtOffset(0, -18);
                content.showText("Period: " + start + " to " + end + " | Group: " + groupBy);
                content.newLineAtOffset(0, -20);
                int count = 0;
                for (Map<String, Object> row : report.data()) {
                    if (count++ >= 30) {
                        break;
                    }
                    content.showText(
                            val(row.get("date")) + " | Occ: " + val(row.get("occupiedRooms")) + "/"
                                    + val(row.get("totalRooms")) + " | Rate: " + val(row.get("occupancyRate"))
                                    + "% | ADR: " + val(row.get("adr")) + " | RevPAR: " + val(row.get("revpar")));
                    content.newLineAtOffset(0, -14);
                }
                content.endText();
            }
            doc.save(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate occupancy PDF");
        }
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
    public String exportGuestAnalyticsCsv(
            UUID hotelId, String hotelHeader, String segment, String tier, BigDecimal minSpend) {
        ReportDtos.GuestAnalyticsResponse report = guestAnalytics(hotelId, hotelHeader, segment, tier, minSpend);
        StringBuilder csv = new StringBuilder();
        csv.append("metric,value\n");
        for (Map.Entry<String, Object> e : report.summary().entrySet()) {
            csv.append(val(e.getKey())).append(',').append(val(e.getValue())).append('\n');
        }
        csv.append("\nsegment,count,criteria\n");
        for (Map<String, Object> seg : report.segments()) {
            csv.append(val(seg.get("name"))).append(',')
                    .append(val(seg.get("count"))).append(',')
                    .append(val(seg.get("criteria"))).append('\n');
        }
        return csv.toString();
    }

    @Transactional(readOnly = true)
    public byte[] exportGuestAnalyticsPdf(
            UUID hotelId, String hotelHeader, String segment, String tier, BigDecimal minSpend) {
        ReportDtos.GuestAnalyticsResponse report = guestAnalytics(hotelId, hotelHeader, segment, tier, minSpend);
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(doc, page)) {
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 14);
                content.newLineAtOffset(50, 760);
                content.showText("Guest Analytics Report");
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
                content.newLineAtOffset(0, -18);
                content.showText("Filters: segment=" + val(segment) + ", tier=" + val(tier) + ", minSpend=" + val(minSpend));
                content.newLineAtOffset(0, -20);
                for (Map.Entry<String, Object> e : report.summary().entrySet()) {
                    content.showText(e.getKey() + ": " + val(e.getValue()));
                    content.newLineAtOffset(0, -14);
                }
                content.endText();
            }
            doc.save(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate guest analytics PDF");
        }
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
        occMap.put("totalRooms", totalRooms);

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

    @Transactional(readOnly = true)
    public ReportDtos.ExecutiveDashboardResponse executive(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Instant todayStart = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant tomorrowStart = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant yesterdayStart = today.minusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        LocalDate monthStartDate = today.withDayOfMonth(1);
        LocalDate nextMonthDate = monthStartDate.plusMonths(1);
        Instant monthStart = monthStartDate.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant nextMonth = nextMonthDate.atStartOfDay(ZoneOffset.UTC).toInstant();

        long totalRooms = roomRepository.countByHotel_Id(hotelId);
        long occupiedRooms = roomRepository.findByHotel_IdAndStatus(hotelId, RoomStatus.OCCUPIED).size();
        long arrivalsTotal = reservationRepository.countArrivalsOnDate(hotelId, today);
        long arrivalsDone = reservationRepository.countArrivalsCheckedInOnDate(hotelId, today);
        long departuresTotal = reservationRepository.countDeparturesOnDate(hotelId, today);
        long departuresDone = reservationRepository.countDeparturesCheckedOutOnDate(hotelId, today);
        long vacantClean = roomRepository.findByHotel_IdAndStatus(hotelId, RoomStatus.VACANT_CLEAN).size();
        long inspected = roomRepository.findByHotel_IdAndStatus(hotelId, RoomStatus.INSPECTED).size();
        long vacantDirty = roomRepository.findByHotel_IdAndStatus(hotelId, RoomStatus.VACANT_DIRTY).size();
        long outOfOrder = roomRepository.findByHotel_IdAndStatus(hotelId, RoomStatus.OUT_OF_ORDER).size();

        BigDecimal occPct = totalRooms > 0
                ? BigDecimal.valueOf((occupiedRooms * 100.0) / totalRooms).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        String occTone = occPct.compareTo(new BigDecimal("70")) > 0
                ? "green"
                : occPct.compareTo(new BigDecimal("50")) >= 0 ? "amber" : "red";

        BigDecimal revenueToday = paymentRepository.sumCompletedForHotelInRange(hotelId, todayStart, tomorrowStart);
        BigDecimal revenueYesterday = paymentRepository.sumCompletedForHotelInRange(hotelId, yesterdayStart, todayStart);
        BigDecimal revenueMonth = paymentRepository.sumCompletedForHotelInRange(hotelId, monthStart, nextMonth);
        long reservationsThisMonth = reservationRepository.countByHotel_IdAndCheckInDateBetween(
                hotelId, monthStartDate, nextMonthDate.minusDays(1));

        List<Reservation> openFolios = reservationRepository.findByHotel_IdAndFolioStatus(hotelId, FolioStatus.OPEN);
        BigDecimal outstanding = BigDecimal.ZERO;
        long unpaidCount = 0;
        for (Reservation r : openFolios) {
            BigDecimal charges = roomChargeRepository.sumAmountForReservation(r.getId());
            BigDecimal tax = charges.multiply(new BigDecimal("0.18")).setScale(2, RoundingMode.HALF_UP);
            BigDecimal grand = charges.add(tax);
            BigDecimal paid = paymentRepository.sumCompletedForReservation(r.getId());
            if (r.isDepositPaid() && r.getDepositAmount() != null) {
                paid = paid.add(r.getDepositAmount());
            }
            BigDecimal due = grand.subtract(paid).setScale(2, RoundingMode.HALF_UP);
            if (due.signum() > 0) {
                outstanding = outstanding.add(due);
                unpaidCount++;
            }
        }

        long hkPendingInProgress = housekeepingTaskRepository.countByHotel_IdAndStatuses(
                hotelId, List.of(HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS));
        long hkUrgent = housekeepingTaskRepository.countUrgentByHotel_IdAndStatuses(
                hotelId, List.of(HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS));
        long staleDnd = roomRepository.findDndStale(hotelId, Instant.now().minus(24, ChronoUnit.HOURS)).size();

        List<ReportDtos.ExecutiveKpiCard> todaysOps = List.of(
                new ReportDtos.ExecutiveKpiCard(
                        "occupancy_today",
                        "Occupancy Today",
                        occPct,
                        occPct.stripTrailingZeros().toPlainString() + "%",
                        occTone,
                        occupiedRooms + " of " + totalRooms + " rooms occupied",
                        null),
                new ReportDtos.ExecutiveKpiCard(
                        "arrivals_today",
                        "Today's Arrivals",
                        BigDecimal.valueOf(arrivalsTotal),
                        String.valueOf(arrivalsTotal),
                        "blue",
                        arrivalsDone + " checked in / " + arrivalsTotal + " expected",
                        "/app/reservations?filter=arrivals_today"),
                new ReportDtos.ExecutiveKpiCard(
                        "departures_today",
                        "Today's Departures",
                        BigDecimal.valueOf(departuresTotal),
                        String.valueOf(departuresTotal),
                        "violet",
                        departuresDone + " checked out / " + departuresTotal + " expected",
                        "/app/reservations?filter=departures_today"),
                new ReportDtos.ExecutiveKpiCard(
                        "available_rooms",
                        "Available Rooms",
                        BigDecimal.valueOf(vacantClean + inspected),
                        String.valueOf(vacantClean + inspected),
                        "green",
                        vacantDirty + " need cleaning, " + outOfOrder + " out of order",
                        null));

        List<ReportDtos.ExecutiveKpiCard> revenueCards = List.of(
                new ReportDtos.ExecutiveKpiCard(
                        "revenue_today",
                        "Revenue Today",
                        revenueToday,
                        money(revenueToday),
                        "green",
                        "vs yesterday: " + money(revenueToday.subtract(revenueYesterday)),
                        null),
                new ReportDtos.ExecutiveKpiCard(
                        "revenue_month",
                        "Revenue This Month",
                        revenueMonth,
                        money(revenueMonth),
                        "blue",
                        reservationsThisMonth + " reservations this month",
                        null),
                new ReportDtos.ExecutiveKpiCard(
                        "outstanding_balances",
                        "Outstanding Balances",
                        outstanding,
                        money(outstanding),
                        outstanding.signum() > 0 ? "red" : "green",
                        unpaidCount + " reservations with unpaid balance",
                        "/app/reservations?filter=unpaid"));

        List<ReportDtos.ExecutiveKpiCard> opsAlerts = List.of(
                new ReportDtos.ExecutiveKpiCard(
                        "pending_hk",
                        "Pending HK Tasks",
                        BigDecimal.valueOf(hkPendingInProgress),
                        String.valueOf(hkPendingInProgress),
                        hkPendingInProgress > 0 ? "amber" : "green",
                        hkUrgent + " urgent",
                        "/app/housekeeping"),
                new ReportDtos.ExecutiveKpiCard(
                        "rooms_need_attention",
                        "Rooms Needing Attention",
                        BigDecimal.valueOf(vacantDirty),
                        String.valueOf(vacantDirty),
                        vacantDirty > 0 ? "amber" : "green",
                        "Need cleaning before next check-in",
                        "/app/housekeeping"),
                new ReportDtos.ExecutiveKpiCard(
                        "dnd_alerts",
                        "DND Alerts",
                        BigDecimal.valueOf(staleDnd),
                        String.valueOf(staleDnd),
                        staleDnd > 0 ? "red" : "green",
                        "Welfare check required",
                        "/app/rooms"));

        List<Reservation> arrivals = reservationRepository.findArrivalsForDashboard(
                hotelId, today, List.of(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN));
        List<Reservation> departures = reservationRepository.findDeparturesForDashboard(
                hotelId, today, List.of(ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT));

        List<ReportDtos.ExecutiveArrivalRow> arrivalRows = arrivals.stream()
                .limit(8)
                .map(r -> new ReportDtos.ExecutiveArrivalRow(
                        r.getId(),
                        r.getBookingReference(),
                        r.getGuest().getFullName(),
                        r.getRoom() != null ? r.getRoom().getRoomNumber() : "TBD",
                        r.getActualCheckIn(),
                        r.getStatus().name()))
                .toList();

        List<ReportDtos.ExecutiveDepartureRow> departureRows = departures.stream()
                .limit(8)
                .map(r -> {
                    BigDecimal charges = roomChargeRepository.sumAmountForReservation(r.getId());
                    BigDecimal tax = charges.multiply(new BigDecimal("0.18")).setScale(2, RoundingMode.HALF_UP);
                    BigDecimal grand = charges.add(tax);
                    BigDecimal paid = paymentRepository.sumCompletedForReservation(r.getId());
                    if (r.isDepositPaid() && r.getDepositAmount() != null) {
                        paid = paid.add(r.getDepositAmount());
                    }
                    BigDecimal due = grand.subtract(paid).setScale(2, RoundingMode.HALF_UP);
                    return new ReportDtos.ExecutiveDepartureRow(
                            r.getId(),
                            r.getBookingReference(),
                            r.getGuest().getFullName(),
                            r.getRoom() != null ? r.getRoom().getRoomNumber() : "TBD",
                            due,
                            r.getStatus().name());
                })
                .toList();

        List<ReportDtos.ExecutiveActivityRow> activity = Stream.concat(
                        reservationRepository.findTop20ByHotel_IdOrderByUpdatedAtDesc(hotelId).stream()
                                .map(r -> new ReportDtos.ExecutiveActivityRow(
                                        r.getUpdatedAt(),
                                        actorNameForReservation(r),
                                        actionForReservation(r),
                                        r.getBookingReference())),
                        Stream.concat(
                                paymentRepository.findTop20ByHotel_IdOrderByProcessedAtDesc(hotelId).stream()
                                        .map(this::toPaymentActivity),
                                roomChargeRepository.findTop20ByReservation_Hotel_IdOrderByChargedAtDesc(hotelId).stream()
                                        .map(this::toChargeActivity)))
                .sorted((a, b) -> b.timestamp().compareTo(a.timestamp()))
                .limit(20)
                .toList();

        return new ReportDtos.ExecutiveDashboardResponse(
                Instant.now().toString(), hotelId, todaysOps, revenueCards, opsAlerts, arrivalRows, departureRows, activity);
    }

    private ReportDtos.ExecutiveActivityRow toPaymentActivity(Payment p) {
        String staff = p.getProcessedBy() != null ? p.getProcessedBy().getUsername() : "System";
        String ref = p.getReservation() != null ? p.getReservation().getBookingReference() : "PAYMENT";
        return new ReportDtos.ExecutiveActivityRow(p.getProcessedAt(), staff, "Payment posted", ref);
    }

    private ReportDtos.ExecutiveActivityRow toChargeActivity(RoomCharge c) {
        String staff = c.getPostedBy() != null && !c.getPostedBy().isBlank() ? c.getPostedBy() : "System";
        String ref = c.getReservation() != null ? c.getReservation().getBookingReference() : "CHARGE";
        return new ReportDtos.ExecutiveActivityRow(c.getChargedAt(), staff, "Charge posted", ref);
    }

    private String actorNameForReservation(Reservation r) {
        if (r.getStatus() == ReservationStatus.CHECKED_OUT && r.getCheckedOutBy() != null) {
            return r.getCheckedOutBy().getUsername();
        }
        if (r.getStatus() == ReservationStatus.CHECKED_IN && r.getCheckedInBy() != null) {
            return r.getCheckedInBy().getUsername();
        }
        if (r.getBookedByAppUser() != null) {
            return r.getBookedByAppUser().getUsername();
        }
        return "System";
    }

    private String actionForReservation(Reservation r) {
        return switch (r.getStatus()) {
            case CHECKED_IN -> "Checked in guest";
            case CHECKED_OUT -> "Checked out guest";
            case CANCELLED -> "Cancelled reservation";
            case NO_SHOW -> "Marked no-show";
            default -> "Updated reservation";
        };
    }

    private String money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String val(Object value) {
        return value == null ? "" : String.valueOf(value).replace(",", " ");
    }
}
