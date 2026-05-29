package com.hms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hms.api.dto.ApiDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.ReservationStatus;
import com.hms.entity.Hotel;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.RoomChargeRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OverstayChargeService {

    private static final String SOURCE = "OVERSTAY";

    private final RoomChargeRepository roomChargeRepository;
    private final ChargeService chargeService;
    private final ObjectMapper objectMapper;

    public OverstayChargeService(
            RoomChargeRepository roomChargeRepository, ChargeService chargeService, ObjectMapper objectMapper) {
        this.roomChargeRepository = roomChargeRepository;
        this.chargeService = chargeService;
        this.objectMapper = objectMapper;
    }

    public ApiDtos.OverstayStatusResponse preview(Reservation reservation, Instant evaluatedAt) {
        Calculation calc = calculate(reservation, evaluatedAt != null ? evaluatedAt : Instant.now());
        return toResponse(calc);
    }

    @Transactional
    public RoomCharge postIfNeeded(Reservation reservation, Instant evaluatedAt, String postedBy) {
        Calculation calc = calculate(reservation, evaluatedAt != null ? evaluatedAt : Instant.now());
        if (!calc.enabled || calc.amountToPost.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        ObjectNode metadata = objectMapper.createObjectNode();
        metadata.put("source", SOURCE);
        metadata.put("reservationId", reservation.getId().toString());
        metadata.put("scheduledCheckoutAt", calc.scheduledCheckoutAt.toString());
        metadata.put("graceEndsAt", calc.graceEndsAt.toString());
        metadata.put("evaluatedAt", calc.evaluatedAt.toString());
        metadata.put("billableHours", calc.billableHours);
        metadata.put("fullNight", calc.fullNight);
        metadata.put("projectedCharge", calc.projectedCharge);
        metadata.put("alreadyPosted", calc.alreadyPosted);
        metadata.put("amountToPost", calc.amountToPost);
        return chargeService.postFolioCharge(
                reservation.getHotel().getId(),
                reservation,
                calc.amountToPost,
                calc.alreadyPosted.compareTo(BigDecimal.ZERO) > 0
                        ? "Overstay fee adjustment"
                        : "Overstay / late checkout fee",
                ChargeType.LATE_CHECKOUT,
                postedBy,
                metadata.toString());
    }

    private Calculation calculate(Reservation reservation, Instant evaluatedAt) {
        Hotel hotel = reservation.getHotel();
        boolean enabled = hotel.isOverstayAutoPostEnabled();
        int graceMinutes = safeInt(hotel.getOverstayGraceMinutes(), 60);
        BigDecimal hourlyPercent = percentOr(hotel.getOverstayHourlyPercent(), "1.50");
        BigDecimal halfDayCapPercent = percentOr(hotel.getOverstayHalfDayCapPercent(), "50.00");
        int fullNightAfter = safeInt(hotel.getOverstayFullDayAfterHours(), 6);
        BigDecimal maxDailyPercent = percentOr(hotel.getOverstayMaxDailyPercent(), "100.00");
        Instant scheduled = scheduledCheckoutAt(reservation);
        Instant graceEnds = scheduled.plus(Duration.ofMinutes(graceMinutes));
        BigDecimal nightly = money(reservation.getNightlyRate());
        BigDecimal alreadyPosted = alreadyPostedOverstay(reservation);
        if (!enabled || reservation.getStatus() != ReservationStatus.CHECKED_IN || nightly.compareTo(BigDecimal.ZERO) <= 0) {
            return new Calculation(
                    enabled,
                    safeTiming(hotel.getOverstayPostTiming()),
                    graceMinutes,
                    hourlyPercent,
                    halfDayCapPercent,
                    fullNightAfter,
                    maxDailyPercent,
                    hotel.isOverstayApplyTax(),
                    scheduled,
                    graceEnds,
                    evaluatedAt,
                    true,
                    false,
                    0,
                    0,
                    false,
                    nightly,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    alreadyPosted,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    hotel.getCurrency(),
                    enabled ? "No overstay fee is currently due." : "Automatic overstay charges are disabled.");
        }

        long minutesLate = Math.max(0, Duration.between(scheduled, evaluatedAt).toMinutes());
        long minutesAfterGrace = Math.max(0, Duration.between(graceEnds, evaluatedAt).toMinutes());
        if (minutesAfterGrace <= 0) {
            return new Calculation(
                    enabled,
                    safeTiming(hotel.getOverstayPostTiming()),
                    graceMinutes,
                    hourlyPercent,
                    halfDayCapPercent,
                    fullNightAfter,
                    maxDailyPercent,
                    hotel.isOverstayApplyTax(),
                    scheduled,
                    graceEnds,
                    evaluatedAt,
                    true,
                    minutesLate > 0,
                    minutesLate,
                    0,
                    false,
                    nightly,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    alreadyPosted,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    hotel.getCurrency(),
                    "Guest is still inside the overstay grace period.");
        }

        long billableHours = (minutesAfterGrace + 59) / 60;
        boolean fullNight = billableHours >= fullNightAfter;
        BigDecimal maxDailyCharge = nightly.multiply(maxDailyPercent).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal projected;
        if (fullNight) {
            long chargeDays = Math.max(1, (billableHours + 23) / 24);
            projected = maxDailyCharge.multiply(BigDecimal.valueOf(chargeDays)).setScale(2, RoundingMode.HALF_UP);
        } else {
            BigDecimal halfDayCap = nightly
                    .multiply(halfDayCapPercent)
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
            projected = nightly
                    .multiply(hourlyPercent)
                    .multiply(BigDecimal.valueOf(billableHours))
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
            projected = projected.min(halfDayCap).min(maxDailyCharge).setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal toPost = projected.subtract(alreadyPosted).setScale(2, RoundingMode.HALF_UP);
        if (toPost.compareTo(BigDecimal.ZERO) < 0) {
            toPost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return new Calculation(
                enabled,
                safeTiming(hotel.getOverstayPostTiming()),
                graceMinutes,
                hourlyPercent,
                halfDayCapPercent,
                fullNightAfter,
                maxDailyPercent,
                hotel.isOverstayApplyTax(),
                scheduled,
                graceEnds,
                evaluatedAt,
                false,
                true,
                minutesLate,
                billableHours,
                fullNight,
                nightly,
                projected,
                alreadyPosted,
                toPost,
                hotel.getCurrency(),
                toPost.compareTo(BigDecimal.ZERO) > 0
                        ? "Overstay fee is ready to post."
                        : "Projected overstay fee is already posted.");
    }

    private ApiDtos.OverstayStatusResponse toResponse(Calculation c) {
        return new ApiDtos.OverstayStatusResponse(
                c.enabled,
                c.postTiming,
                c.graceMinutes,
                c.hourlyPercent,
                c.halfDayCapPercent,
                c.fullNightAfterHours,
                c.maxDailyPercent,
                c.applyTax,
                c.scheduledCheckoutAt,
                c.graceEndsAt,
                c.evaluatedAt,
                c.inGrace,
                c.overdue,
                c.minutesLate,
                c.billableHours,
                c.fullNight,
                c.nightlyRate,
                c.projectedCharge,
                c.alreadyPosted,
                c.amountToPost,
                c.currency,
                c.message);
    }

    private Instant scheduledCheckoutAt(Reservation reservation) {
        Hotel hotel = reservation.getHotel();
        ZoneId zone = zoneOrUtc(hotel.getTimezone());
        LocalTime checkoutTime = parseTime(hotel.getCheckOutTime());
        return LocalDateTime.of(reservation.getCheckOutDate(), checkoutTime).atZone(zone).toInstant();
    }

    private ZoneId zoneOrUtc(String value) {
        if (value == null || value.isBlank()) {
            return ZoneId.of("UTC");
        }
        try {
            return ZoneId.of(value);
        } catch (RuntimeException ignored) {
            return ZoneId.of("UTC");
        }
    }

    private LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) {
            return LocalTime.of(11, 0);
        }
        try {
            return LocalTime.parse(value.length() == 5 ? value : value.substring(0, 5));
        } catch (RuntimeException ignored) {
            return LocalTime.of(11, 0);
        }
    }

    private BigDecimal alreadyPostedOverstay(Reservation reservation) {
        List<RoomCharge> charges =
                roomChargeRepository.findByReservationOrOriginatingReservationAndChargeType(
                        reservation.getId(), ChargeType.LATE_CHECKOUT);
        return charges.stream()
                .filter(this::isOverstayLedgerRow)
                .map(c -> c.getAmount() != null ? c.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private boolean isOverstayLedgerRow(RoomCharge charge) {
        String metadata = charge.getMetadataJson() != null ? charge.getMetadataJson().toLowerCase() : "";
        String description = charge.getDescription() != null ? charge.getDescription().toLowerCase() : "";
        return metadata.contains("\"source\":\"" + SOURCE.toLowerCase() + "\"")
                || metadata.contains("reversalfor")
                || description.contains("overstay charge reversed");
    }

    private static BigDecimal money(BigDecimal value) {
        return value != null ? value.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal percentOr(BigDecimal value, String fallback) {
        return (value != null ? value : new BigDecimal(fallback)).max(BigDecimal.ZERO);
    }

    private static int safeInt(Integer value, int fallback) {
        return value != null ? value : fallback;
    }

    private static String safeTiming(String value) {
        return value != null && !value.isBlank() ? value : "AT_CHECKOUT";
    }

    private record Calculation(
            boolean enabled,
            String postTiming,
            int graceMinutes,
            BigDecimal hourlyPercent,
            BigDecimal halfDayCapPercent,
            int fullNightAfterHours,
            BigDecimal maxDailyPercent,
            boolean applyTax,
            Instant scheduledCheckoutAt,
            Instant graceEndsAt,
            Instant evaluatedAt,
            boolean inGrace,
            boolean overdue,
            long minutesLate,
            long billableHours,
            boolean fullNight,
            BigDecimal nightlyRate,
            BigDecimal projectedCharge,
            BigDecimal alreadyPosted,
            BigDecimal amountToPost,
            String currency,
            String message) {}
}
