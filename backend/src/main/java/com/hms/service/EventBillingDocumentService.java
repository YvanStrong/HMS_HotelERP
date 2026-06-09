package com.hms.service;

import com.hms.api.dto.EventOpsDtos;
import com.hms.domain.EventBillingDocumentType;
import com.hms.domain.EventQuoteStatus;
import com.hms.entity.EventBillingDocument;
import com.hms.entity.EventQuote;
import com.hms.entity.GroupBooking;
import com.hms.entity.Payment;
import com.hms.entity.Reservation;
import com.hms.repository.EventBillingDocumentRepository;
import com.hms.repository.EventQuoteRepository;
import com.hms.repository.GroupBookingRepository;
import com.hms.repository.PaymentRepository;
import com.hms.repository.ReservationRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventBillingDocumentService {

    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");

    private final EventBillingDocumentRepository documentRepository;
    private final EventQuoteRepository quoteRepository;
    private final GroupBookingRepository groupBookingRepository;
    private final ReservationRepository reservationRepository;
    private final PaymentRepository paymentRepository;
    private final EventQuoteService eventQuoteService;
    private final EventDocumentPdfService eventDocumentPdfService;
    private final TenantAccessService tenantAccessService;

    @Transactional
    public EventBillingDocument syncFromQuote(UUID quoteId) {
        EventQuote quote = quoteRepository.findById(quoteId).orElseThrow(() -> notFound());
        if (quote.getStatus() != EventQuoteStatus.CONTRACTED) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "QUOTE_NOT_CONTRACTED",
                    "Billing documents are created when the quote is contracted.");
        }
        GroupBooking group = groupBookingRepository
                .findWithBillingRelations(quote.getGroupBooking().getId(), quote.getHotel().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        Reservation billing = resolveBillingReservation(group);
        BigDecimal total = quote.getTotalAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal paid = billing != null ? sumCompletedPayments(billing.getId()) : BigDecimal.ZERO;
        EventBillingDocumentType type = resolveType(paid, total);

        EventBillingDocument doc = documentRepository
                .findByEventQuote_Id(quoteId)
                .orElseGet(() -> {
                    EventBillingDocument created = new EventBillingDocument();
                    created.setHotel(quote.getHotel());
                    created.setGroupBooking(quote.getGroupBooking());
                    created.setEventBooking(quote.getEventBooking());
                    created.setEventQuote(quote);
                    created.setCurrency(quote.getHotel().getCurrency() != null ? quote.getHotel().getCurrency() : "USD");
                    return created;
                });

        EventBillingDocumentType previousType = doc.getDocumentType();
        doc.setDocumentType(type);
        doc.setTotalAmount(total);
        doc.setAmountPaid(paid);
        doc.setBalanceDue(total.subtract(paid).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        if (doc.getDocumentNumber() == null || previousType != type) {
            doc.setDocumentNumber(nextDocumentNumber(quote.getHotel().getId(), type));
        }
        return documentRepository.save(doc);
    }

    @Transactional
    public void syncForReservation(UUID reservationId) {
        Reservation r = reservationRepository.findById(reservationId).orElse(null);
        if (r == null || r.getGroupBooking() == null) {
            return;
        }
        UUID groupId = r.getGroupBooking().getId();
        List<EventQuote> contracted =
                quoteRepository.findByGroupWithEvent(r.getHotel().getId(), groupId).stream()
                        .filter(q -> q.getStatus() == EventQuoteStatus.CONTRACTED)
                        .toList();
        for (EventQuote q : contracted) {
            try {
                syncFromQuote(q.getId());
            } catch (Exception ex) {
                log.warn("Could not sync event billing document for quote {}: {}", q.getId(), ex.getMessage());
            }
        }
    }

    @Transactional
    public List<EventOpsDtos.EventBillingDocumentRow> listByHotel(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        for (EventQuote quote : quoteRepository.findContractedByHotel(hotelId)) {
            try {
                syncFromQuote(quote.getId());
            } catch (Exception ex) {
                log.warn("Sync skipped for quote {}: {}", quote.getId(), ex.getMessage());
            }
        }
        return documentRepository.findByHotel_IdOrderByUpdatedAtDesc(hotelId).stream()
                .map(this::toRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public byte[] pdfBytes(UUID hotelId, String hotelHeader, UUID documentId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        EventBillingDocument doc = documentRepository
                .findByIdAndHotel_Id(documentId, hotelId)
                .orElseThrow(() -> notFound());
        return buildPdf(doc, hotelHeader);
    }

    @Transactional
    public byte[] pdfBytesForEvent(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        EventQuote quote = quoteRepository
                .findByEventBooking_Id(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quote not found"));
        if (!quote.getGroupBooking().getId().equals(groupId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Event not found");
        }
        EventBillingDocument doc = documentRepository
                .findByEventQuote_Id(quote.getId())
                .orElseGet(() -> syncFromQuote(quote.getId()));
        return buildPdf(doc, hotelHeader);
    }

    private byte[] buildPdf(EventBillingDocument doc, String hotelHeader) {
        String hdr = (hotelHeader != null && !hotelHeader.isBlank())
                ? hotelHeader
                : doc.getHotel().getId().toString();
        EventOpsDtos.PrintableQuoteResponse printable = eventQuoteService.getPrintableQuote(
                doc.getHotel().getId(), hdr, doc.getGroupBooking().getId(), doc.getEventBooking().getId());
        return eventDocumentPdfService.renderBillingDocumentPdf(
                printable,
                doc.getDocumentType(),
                doc.getDocumentNumber(),
                doc.getAmountPaid(),
                doc.getBalanceDue());
    }

    private EventOpsDtos.EventBillingDocumentRow toRow(EventBillingDocument doc) {
        return new EventOpsDtos.EventBillingDocumentRow(
                doc.getId(),
                doc.getDocumentNumber(),
                doc.getDocumentType(),
                doc.getEventBooking().getId(),
                doc.getEventBooking().getEventName(),
                doc.getGroupBooking().getGroupName(),
                doc.getGroupBooking().getContactPerson(),
                doc.getTotalAmount(),
                doc.getAmountPaid(),
                doc.getBalanceDue(),
                doc.getCurrency(),
                doc.getCreatedAt(),
                doc.getUpdatedAt());
    }

    static EventBillingDocumentType resolveType(BigDecimal paid, BigDecimal total) {
        BigDecimal p = paid != null ? paid : BigDecimal.ZERO;
        BigDecimal t = total != null ? total : BigDecimal.ZERO;
        if (p.compareTo(TOLERANCE) <= 0) {
            return EventBillingDocumentType.DELIVERY;
        }
        if (p.add(TOLERANCE).compareTo(t) >= 0) {
            return EventBillingDocumentType.INVOICE;
        }
        return EventBillingDocumentType.PROFORMA;
    }

    private BigDecimal sumCompletedPayments(UUID reservationId) {
        return paymentRepository.findByReservation_IdOrderByProcessedAtDesc(reservationId).stream()
                .filter(p -> "COMPLETED".equalsIgnoreCase(p.getStatus()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private Reservation resolveBillingReservation(GroupBooking group) {
        Reservation master = group.getMasterReservation();
        if (master == null && !group.isUsesRoomBlock()) {
            master = reservationRepository
                    .findFirstByGroupBooking_IdAndBookingSource(group.getId(), "GROUP_EVENT_FOLIO")
                    .orElse(null);
        }
        return master;
    }

    private String nextDocumentNumber(UUID hotelId, EventBillingDocumentType type) {
        String prefix = switch (type) {
            case PROFORMA -> "PF-EVT-" + Year.now().getValue() + "-";
            case DELIVERY -> "DEL-EVT-" + Year.now().getValue() + "-";
            case INVOICE -> "INV-EVT-" + Year.now().getValue() + "-";
        };
        int next = documentRepository.maxSuffixForPrefix(hotelId, prefix + "%") + 1;
        return prefix + String.format("%05d", next);
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Event billing document not found");
    }
}
