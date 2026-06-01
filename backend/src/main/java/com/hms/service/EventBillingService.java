package com.hms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.EventOpsDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.EventQuoteLineType;
import com.hms.domain.EventQuoteStatus;
import com.hms.entity.EventQuote;
import com.hms.entity.EventQuoteLine;
import com.hms.entity.GroupBooking;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.EventQuoteLineRepository;
import com.hms.repository.EventQuoteRepository;
import com.hms.repository.GroupBookingRepository;
import com.hms.repository.ReservationRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventBillingService {

    private final EventQuoteRepository quoteRepository;
    private final EventQuoteLineRepository quoteLineRepository;
    private final GroupBookingRepository groupBookingRepository;
    private final ReservationRepository reservationRepository;
    private final ChargeService chargeService;
    private final GroupBillingRouter groupBillingRouter;
    private final TenantAccessService tenantAccessService;
    private final ObjectMapper objectMapper;

    @Transactional
    public void postEventChargesToFolio(UUID quoteId) {
        EventQuote quote = quoteRepository.findById(quoteId).orElseThrow(() -> notFound());
        if (quote.getChargesPostedAt() != null) {
            log.warn("Event quote {} charges already posted at {}", quoteId, quote.getChargesPostedAt());
            return;
        }
        GroupBooking group = groupBookingRepository
                .findWithBillingRelations(quote.getGroupBooking().getId(), quote.getHotel().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        Reservation target = resolveBillingReservation(group);
        UUID hotelId = quote.getHotel().getId();

        if (quote.isDepositPaid() && quote.getDepositRequired().signum() > 0) {
            postCharge(
                    hotelId,
                    target,
                    quote.getDepositRequired().negate(),
                    "Event deposit credit — " + quote.getEventBooking().getEventName(),
                    ChargeType.OTHER,
                    quoteId,
                    null);
        }

        List<EventQuoteLine> lines = quoteLineRepository.findByEventQuote_IdOrderByCreatedAtAsc(quoteId);
        for (EventQuoteLine line : lines) {
            if (line.getChargeReferenceId() != null && !line.getChargeReferenceId().isBlank()) {
                log.warn("Skipping quote line {} — already posted as {}", line.getId(), line.getChargeReferenceId());
                continue;
            }
            ChargeType type = mapLineType(line.getLineType());
            RoomCharge charge = postCharge(
                    hotelId,
                    target,
                    line.getLineTotal(),
                    line.getDescription() + " — event quote",
                    type,
                    quoteId,
                    line.getId());
            line.setChargeReferenceId(charge.getId().toString());
            quoteLineRepository.save(line);
        }
        quote.setChargesPostedAt(Instant.now());
        quoteRepository.save(quote);
        log.info("Posted event charges for quoteId={} groupId={}", quoteId, group.getId());
    }

    @Transactional
    public void reverseEventCharges(UUID quoteId) {
        EventQuote quote = quoteRepository.findById(quoteId).orElseThrow(() -> notFound());
        GroupBooking group = groupBookingRepository
                .findWithBillingRelations(quote.getGroupBooking().getId(), quote.getHotel().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        Reservation target = resolveBillingReservation(group);
        UUID hotelId = quote.getHotel().getId();
        String staff = tenantAccessService.currentUser().getUsername();

        List<EventQuoteLine> lines = quoteLineRepository.findByEventQuote_IdOrderByCreatedAtAsc(quoteId);
        for (EventQuoteLine line : lines) {
            if (line.getChargeReferenceId() == null || line.getChargeReferenceId().isBlank()) {
                continue;
            }
            ChargeType type = mapLineType(line.getLineType());
            String desc = line.getDescription() + " — REVERSED";
            postCharge(hotelId, target, line.getLineTotal().negate(), desc, type, quoteId, line.getId());
            line.setChargeReferenceId(null);
            line.setDescription(line.getDescription() + " (reversed)");
            quoteLineRepository.save(line);
        }
        quote.setChargesReversedAt(Instant.now());
        quoteRepository.save(quote);
        log.info("Reversed event charges quoteId={} by {}", quoteId, staff);
    }

    @Transactional(readOnly = true)
    public EventOpsDtos.EventBillingSummaryResponse getEventBillingSummary(
            UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<EventQuote> quotes = quoteRepository.findByGroupWithEvent(hotelId, groupId);
        BigDecimal totalQuoted = BigDecimal.ZERO;
        BigDecimal totalAccepted = BigDecimal.ZERO;
        BigDecimal totalPosted = BigDecimal.ZERO;
        BigDecimal depositCollected = BigDecimal.ZERO;
        List<EventOpsDtos.EventBillingRow> rows = new java.util.ArrayList<>();
        for (EventQuote q : quotes) {
            totalQuoted = totalQuoted.add(q.getTotalAmount());
            if (q.getStatus() == EventQuoteStatus.ACCEPTED || q.getStatus() == EventQuoteStatus.CONTRACTED) {
                totalAccepted = totalAccepted.add(q.getTotalAmount());
            }
            if (q.getChargesPostedAt() != null) {
                totalPosted = totalPosted.add(q.getTotalAmount());
            }
            if (q.isDepositPaid()) {
                depositCollected = depositCollected.add(q.getDepositRequired());
            }
            rows.add(new EventOpsDtos.EventBillingRow(
                    q.getEventBooking().getId(),
                    q.getEventBooking().getEventName(),
                    q.getStatus(),
                    q.getTotalAmount(),
                    q.isDepositPaid(),
                    q.getChargesPostedAt() != null,
                    q.getChargesPostedAt()));
        }
        BigDecimal outstanding = totalAccepted.subtract(depositCollected).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        return new EventOpsDtos.EventBillingSummaryResponse(
                groupId, totalQuoted, totalAccepted, totalPosted, depositCollected, outstanding, rows);
    }

    private Reservation resolveBillingReservation(GroupBooking group) {
        Reservation master = group.getMasterReservation();
        if (master == null) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "GROUP_MASTER_REQUIRED",
                    "Link a master reservation to this group before posting event charges.");
        }
        return reservationRepository
                .findByIdAndHotel_IdWithGroupBilling(master.getId(), group.getHotel().getId())
                .orElse(master);
    }

    private RoomCharge postCharge(
            UUID hotelId,
            Reservation reservation,
            BigDecimal amount,
            String description,
            ChargeType chargeType,
            UUID quoteId,
            UUID quoteLineId) {
        String meta;
        try {
            meta = objectMapper.writeValueAsString(Map.of(
                    "eventQuoteId", quoteId.toString(),
                    "eventQuoteLineId", quoteLineId != null ? quoteLineId.toString() : ""));
        } catch (Exception e) {
            meta = null;
        }
        Reservation routed = groupBillingRouter.resolveFolioReservation(reservation, chargeType);
        return chargeService.postFolioCharge(
                hotelId, routed, amount.setScale(2, RoundingMode.HALF_UP), description, chargeType, null, meta);
    }

    private ChargeType mapLineType(EventQuoteLineType lineType) {
        return switch (lineType) {
            case VENUE_RENTAL -> ChargeType.OTHER;
            case CATERING -> ChargeType.BANQUET;
            case AV, DECOR -> ChargeType.RECREATION;
            case LABOR, OTHER -> ChargeType.OTHER;
        };
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Quote not found");
    }
}
