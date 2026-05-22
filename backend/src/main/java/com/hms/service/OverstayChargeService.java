package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.ApiDtos;
import com.hms.domain.ChargeType;
import com.hms.entity.Hotel;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.FolioTransactionRepository;
import com.hms.repository.RoomChargeRepository;
import com.hms.service.folio.FolioLedgerService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OverstayChargeService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final RoomChargeRepository roomChargeRepository;
    private final FolioTransactionRepository folioTransactionRepository;
    private final ChargeService chargeService;
    private final GroupBillingRouter groupBillingRouter;
    private final FolioLedgerService folioLedgerService;
    private final ObjectMapper objectMapper;

    public OverstayChargeService(
            RoomChargeRepository roomChargeRepository,
            FolioTransactionRepository folioTransactionRepository,
            ChargeService chargeService,
            GroupBillingRouter groupBillingRouter,
            FolioLedgerService folioLedgerService,
            ObjectMapper objectMapper) {
        this.roomChargeRepository = roomChargeRepository;
        this.folioTransactionRepository = folioTransactionRepository;
        this.chargeService = chargeService;
        this.groupBillingRouter = groupBillingRouter;
        this.folioLedgerService = folioLedgerService;
        this.objectMapper = objectMapper;
    }

    public ApiDtos.OverstayStatus preview(Reservation reservation, Instant evaluatedAt) {
        Calculation calc = calculate(reservation, evaluatedAt);
        RoomCharge existing = findExistingCharge(reservation);
        BigDecimal posted = existing != null ? existing.getAmount() : BigDecimal.ZERO;
        return new ApiDtos.OverstayStatus(
                reservation.getId(),
                calc.enabled(),
                calc.overdue(),
                calc.scheduledCheckout().toString(),
                calc.evaluatedAt().toString(),
                calc.lateMinutes(),
                calc.billableHours(),
                calc.charge(),
                posted.setScale(2, RoundingMode.HALF_UP),
                reservation.getHotel() != null ? reservation.getHotel().getCurrency() : "USD",
                calc.policySummary());
    }

    @Transactional
    public ApiDtos.OverstayStatus ensurePosted(Reservation reservation, Instant evaluatedAt, String postedBy) {
        Calculation calc = calculate(reservation, evaluatedAt);
        if (!calc.enabled() || !calc.overdue() || calc.charge().compareTo(BigDecimal.ZERO) <= 0) {
            return preview(reservation, evaluatedAt);
        }
        RoomCharge existing = findExistingCharge(reservation);
        String metadata = metadataJson(reservation, calc);
        if (existing == null) {
            RoomCharge posted = chargeService.postFolioCharge(
                    reservation.getHotel().getId(),
                    reservation,
                    calc.charge(),
                    description(calc),
                    ChargeType.LATE_CHECKOUT,
                    postedBy,
                    metadata);
            posted.setMetadataJson(metadata);
            return preview(reservation, evaluatedAt);
        }
        existing.setAmount(calc.charge());
        existing.setDescription(description(calc));
        existing.setMetadataJson(metadata);
        existing.setPostedBy(postedBy != null ? postedBy : existing.getPostedBy());
        roomChargeRepository.save(existing);
        folioLedgerService.onRoomChargePosted(existing);
        return preview(reservation, evaluatedAt);
    }

    @Transactional
    public boolean removePostedOverstayCharge(Reservation reservation) {
        RoomCharge existing = findExistingCharge(reservation);
        if (existing == null) {
            return false;
        }
        Reservation folioReservation = existing.getReservation();
        folioTransactionRepository.deleteByRoomCharge_Id(existing.getId());
        roomChargeRepository.delete(existing);
        folioLedgerService.refreshGuestFolioSnapshot(folioReservation);
        return true;
    }

    private RoomCharge findExistingCharge(Reservation reservation) {
        Reservation target = groupBillingRouter.resolveFolioReservation(reservation, ChargeType.LATE_CHECKOUT);
        String reservationMarker = "\"sourceReservationId\":\"" + reservation.getId() + "\"";
        return roomChargeRepository
                .findFirstByReservation_IdAndChargeTypeAndMetadataJsonContainingOrderByChargedAtDesc(
                        target.getId(), ChargeType.LATE_CHECKOUT, reservationMarker)
                .orElse(null);
    }

    private Calculation calculate(Reservation reservation, Instant evaluatedAt) {
        Hotel hotel = reservation.getHotel();
        Instant now = evaluatedAt != null ? evaluatedAt : Instant.now();
        if (hotel == null || !hotel.isOverstayAutoPostEnabled()) {
            Instant scheduled = scheduledCheckout(reservation);
            return Calculation.disabled(scheduled, now, policySummary(hotel));
        }
        Instant scheduled = scheduledCheckout(reservation);
        long lateMinutesRaw = Duration.between(scheduled, now).toMinutes();
        long grace = Math.max(0, nz(hotel.getOverstayGraceMinutes(), 60));
        long lateMinutes = Math.max(0, lateMinutesRaw);
        long billableMinutes = Math.max(0, lateMinutes - grace);
        long billableHours = billableMinutes <= 0 ? 0 : (long) Math.ceil(billableMinutes / 60.0d);
        BigDecimal charge = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (billableHours > 0) {
            BigDecimal nightly = reservation.getNightlyRate() != null ? reservation.getNightlyRate() : BigDecimal.ZERO;
            BigDecimal hourlyPercent = nz(hotel.getOverstayHourlyPercent(), new BigDecimal("1.50"));
            BigDecimal raw = nightly
                    .multiply(hourlyPercent)
                    .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(billableHours));
            int fullAfter = Math.max(1, nz(hotel.getOverstayFullDayAfterHours(), 6));
            if (billableHours >= fullAfter) {
                raw = nightly;
            }
            BigDecimal halfCap = nightly
                    .multiply(nz(hotel.getOverstayHalfDayCapPercent(), new BigDecimal("50.00")))
                    .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP);
            BigDecimal dailyCap = nightly
                    .multiply(nz(hotel.getOverstayMaxDailyPercent(), new BigDecimal("100.00")))
                    .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP);
            BigDecimal cap = billableHours < fullAfter ? minPositive(halfCap, dailyCap) : dailyCap;
            charge = minPositive(raw, cap).setScale(2, RoundingMode.HALF_UP);
        }
        return new Calculation(true, billableHours > 0, scheduled, now, lateMinutes, billableHours, charge, policySummary(hotel));
    }

    private Instant scheduledCheckout(Reservation reservation) {
        Hotel hotel = reservation.getHotel();
        ZoneId zone = ZoneId.of(hotel != null && hotel.getTimezone() != null && !hotel.getTimezone().isBlank()
                ? hotel.getTimezone()
                : "UTC");
        LocalTime time = parseTime(hotel != null ? hotel.getCheckOutTime() : null);
        return reservation.getCheckOutDate().atTime(time).atZone(zone).toInstant();
    }

    private static LocalTime parseTime(String raw) {
        if (raw == null || raw.isBlank()) return LocalTime.of(11, 0);
        try {
            return LocalTime.parse(raw.trim(), TIME_FMT);
        } catch (Exception ignored) {
            return LocalTime.of(11, 0);
        }
    }

    private String metadataJson(Reservation reservation, Calculation calc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", "OVERSTAY_AUTO");
        m.put("sourceReservationId", reservation.getId().toString());
        m.put("scheduledCheckout", calc.scheduledCheckout().toString());
        m.put("evaluatedAt", calc.evaluatedAt().toString());
        m.put("lateMinutes", calc.lateMinutes());
        m.put("billableHours", calc.billableHours());
        m.put("policySummary", calc.policySummary());
        try {
            return objectMapper.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            return "{\"kind\":\"OVERSTAY_AUTO\",\"sourceReservationId\":\"" + reservation.getId() + "\"}";
        }
    }

    private static String description(Calculation calc) {
        return "Automatic overstay / late checkout charge (" + calc.billableHours() + " billable hour"
                + (calc.billableHours() == 1 ? "" : "s") + ")";
    }

    private static String policySummary(Hotel h) {
        if (h == null) return "Overstay policy unavailable";
        return "Grace " + nz(h.getOverstayGraceMinutes(), 60)
                + " min, "
                + nz(h.getOverstayHourlyPercent(), new BigDecimal("1.50")).stripTrailingZeros().toPlainString()
                + "% of nightly rate per hour, full night after "
                + nz(h.getOverstayFullDayAfterHours(), 6)
                + " billable hour(s).";
    }

    private static int nz(Integer value, int fallback) {
        return value != null ? value : fallback;
    }

    private static BigDecimal nz(BigDecimal value, BigDecimal fallback) {
        return value != null ? value : fallback;
    }

    private static BigDecimal minPositive(BigDecimal a, BigDecimal b) {
        if (a == null || a.compareTo(BigDecimal.ZERO) <= 0) return b != null ? b : BigDecimal.ZERO;
        if (b == null || b.compareTo(BigDecimal.ZERO) <= 0) return a;
        return a.min(b);
    }

    private record Calculation(
            boolean enabled,
            boolean overdue,
            Instant scheduledCheckout,
            Instant evaluatedAt,
            long lateMinutes,
            long billableHours,
            BigDecimal charge,
            String policySummary) {
        static Calculation disabled(Instant scheduled, Instant evaluatedAt, String policySummary) {
            return new Calculation(
                    false,
                    false,
                    scheduled,
                    evaluatedAt,
                    Math.max(0, Duration.between(scheduled, evaluatedAt).toMinutes()),
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    policySummary);
        }
    }
}
