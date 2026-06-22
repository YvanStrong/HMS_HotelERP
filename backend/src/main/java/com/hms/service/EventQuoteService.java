package com.hms.service;

import com.hms.api.dto.EventBookingDtos;
import com.hms.api.dto.EventOpsDtos;
import com.hms.domain.EventQuoteLineType;
import com.hms.domain.EventQuoteStatus;
import com.hms.entity.*;
import com.hms.repository.*;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventQuoteService {

    private static final Set<EventQuoteStatus> TERMINAL = EnumSet.of(EventQuoteStatus.CANCELLED);

    private final EventQuoteRepository quoteRepository;
    private final EventQuoteLineRepository quoteLineRepository;
    private final EventCateringLineRepository cateringLineRepository;
    private final EventCateringPackageRepository packageRepository;
    private final DepotProductRepository depotProductRepository;
    private final EventBookingRepository eventBookingRepository;
    private final GroupBookingRepository groupBookingRepository;
    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;
    private final EventBillingService eventBillingService;

    @Lazy
    @Autowired
    private EventBillingDocumentService eventBillingDocumentService;

    @Transactional(readOnly = true)
    public List<EventOpsDtos.CateringLineResponse> listCateringLines(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        assertEvent(hotelId, hotelHeader, groupId, eventId);
        return cateringLineRepository.findByEventBooking_IdOrderByCreatedAtAsc(eventId).stream()
                .map(this::toCateringLine)
                .toList();
    }

    @Transactional
    public EventOpsDtos.CateringLineResponse addCateringLine(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId, EventOpsDtos.CateringLineRequest req) {
        EventBooking event = assertEvent(hotelId, hotelHeader, groupId, eventId);
        EventCateringLine line = new EventCateringLine();
        line.setEventBooking(event);
        applyCateringLine(hotelId, line, req);
        line = cateringLineRepository.save(line);
        EventQuote quote = quoteRepository
                .findByEventBooking_Id(eventId)
                .orElseGet(() -> createDraftQuoteForEvent(event));
        syncQuoteFromCatering(quote, event);
        return toCateringLine(line);
    }

    @Transactional
    public void removeCateringLine(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId, UUID lineId) {
        assertEvent(hotelId, hotelHeader, groupId, eventId);
        EventCateringLine line = cateringLineRepository
                .findByIdAndEventBooking_Id(lineId, eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Catering line not found"));
        cateringLineRepository.delete(line);
        quoteRepository
                .findByEventBooking_Id(eventId)
                .ifPresent(q -> syncQuoteFromCatering(q, q.getEventBooking()));
    }

    @Transactional(readOnly = true)
    public java.util.Optional<EventOpsDtos.QuoteResponse> findQuote(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        assertEvent(hotelId, hotelHeader, groupId, eventId);
        return quoteRepository.findByEventBooking_Id(eventId).map(this::toQuoteResponse);
    }

    @Transactional(readOnly = true)
    public EventOpsDtos.QuoteResponse getQuote(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        return findQuote(hotelId, hotelHeader, groupId, eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quote not found"));
    }

    @Transactional
    public EventOpsDtos.QuoteResponse createDraft(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        EventBooking event = assertEvent(hotelId, hotelHeader, groupId, eventId);
        if (quoteRepository.findByEventBooking_Id(eventId).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "Quote already exists for this event");
        }
        EventQuote quote = createDraftQuoteForEvent(event);
        syncQuoteFromCatering(quote, event);
        return toQuoteResponse(quoteRepository.findByEventBooking_Id(eventId).orElseThrow());
    }

    private EventQuote createDraftQuoteForEvent(EventBooking event) {
        EventQuote quote = new EventQuote();
        quote.setHotel(event.getHotel());
        quote.setGroupBooking(event.getGroupBooking());
        quote.setEventBooking(event);
        quote.setStatus(EventQuoteStatus.DRAFT);
        quote.setValidUntil(LocalDate.now().plusDays(30));
        return quoteRepository.save(quote);
    }

    @Transactional
    public EventOpsDtos.QuoteResponse patchQuote(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId, EventOpsDtos.QuotePatchRequest req) {
        EventQuote quote = loadQuoteForEvent(hotelId, hotelHeader, groupId, eventId);
        if (req.discountAmount() != null) {
            quote.setDiscountAmount(req.discountAmount().max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        }
        if (req.depositRequired() != null) {
            quote.setDepositRequired(req.depositRequired().max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        }
        if (req.depositPaid() != null) quote.setDepositPaid(req.depositPaid());
        if (req.validUntil() != null) quote.setValidUntil(req.validUntil());
        if (req.internalNotes() != null) quote.setInternalNotes(blank(req.internalNotes()));
        if (req.clientNotes() != null) quote.setClientNotes(blank(req.clientNotes()));
        if (req.lines() != null) {
            quote.getLines().clear();
            for (EventOpsDtos.QuoteLineRequest lr : req.lines()) {
                quote.getLines().add(buildQuoteLine(quote, lr));
            }
        }
        if (req.status() != null) {
            updateStatus(quote, req.status());
        } else {
            quote = quoteRepository.save(quote);
            recalculateTotals(quote.getId());
        }
        return toQuoteResponse(loadQuoteForEvent(hotelId, hotelHeader, groupId, eventId));
    }

    @Transactional
    public EventOpsDtos.QuoteResponse acceptQuote(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        EventQuote quote = loadQuoteForEvent(hotelId, hotelHeader, groupId, eventId);
        updateStatus(quote, EventQuoteStatus.ACCEPTED);
        return toQuoteResponse(quoteRepository.findByEventBooking_Id(eventId).orElseThrow());
    }

    @Transactional(readOnly = true)
    public EventOpsDtos.PrintableQuoteResponse getPrintableQuote(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        EventBooking event = assertEvent(hotelId, hotelHeader, groupId, eventId);
        EventQuote quote = quoteRepository
                .findByEventBooking_Id(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quote not found"));
        GroupBooking group = event.getGroupBooking();
        Hotel hotel = event.getHotel();
        return new EventOpsDtos.PrintableQuoteResponse(
                toQuoteResponse(quote),
                toEventResponse(event),
                group.getGroupName(),
                group.getCompanyName(),
                group.getContactPerson(),
                group.getContactEmail(),
                group.getContactPhone(),
                hotel.getName(),
                hotel.getAddress(),
                hotel.getPhone(),
                hotel.getEmail(),
                hotel.getCurrency());
    }

    @Transactional
    public EventOpsDtos.QuoteResponse recalculateTotals(UUID quoteId) {
        EventQuote quote = quoteRepository.findById(quoteId).orElseThrow(() -> notFound());
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        BigDecimal taxFraction = effectiveTaxFraction(
                quote.getHotel().getTaxRate() != null ? quote.getHotel().getTaxRate() : BigDecimal.ZERO);
        for (EventQuoteLine line : quote.getLines()) {
            BigDecimal lt = line.getLineTotal().setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lt);
            if (line.isTaxable() && taxFraction.signum() > 0) {
                tax = tax.add(lt.multiply(taxFraction).setScale(4, RoundingMode.HALF_UP));
            }
        }
        subtotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        tax = tax.setScale(2, RoundingMode.HALF_UP);
        BigDecimal discount = quote.getDiscountAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(tax).subtract(discount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        quote.setSubtotal(subtotal);
        quote.setTaxAmount(tax);
        quote.setTotalAmount(total);
        quoteRepository.save(quote);
        return toQuoteResponse(quote);
    }

    @Transactional
    public void updateStatus(EventQuote quote, EventQuoteStatus newStatus) {
        EventQuoteStatus current = quote.getStatus();
        if (current == newStatus) return;
        if (TERMINAL.contains(current) && newStatus != EventQuoteStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "Quote is cancelled and cannot change status");
        }
        if (newStatus == EventQuoteStatus.CANCELLED && current == EventQuoteStatus.CONTRACTED) {
            eventBillingService.reverseEventCharges(quote.getId());
        }
        assertTransition(current, newStatus);
        quote.setStatus(newStatus);
        if (newStatus == EventQuoteStatus.ACCEPTED) {
            if (quote.getDepositRequired().compareTo(BigDecimal.ZERO) == 0) {
                quote.setDepositPaid(true);
            }
            quoteRepository.save(quote);
            return;
        }
        if (newStatus == EventQuoteStatus.CONTRACTED) {
            if (quote.getLines().isEmpty() || quote.getTotalAmount().signum() <= 0) {
                recalculateTotals(quote.getId());
                quote = quoteRepository.findById(quote.getId()).orElseThrow(() -> notFound());
            }
            if (quote.getLines().isEmpty()) {
                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "QUOTE_NO_LINES",
                        "Add catering lines before contracting this quote.");
            }
            quoteRepository.save(quote);
            GroupBooking group = groupBookingRepository
                    .findWithBillingRelations(quote.getGroupBooking().getId(), quote.getHotel().getId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
            if (group.getMasterReservation() != null) {
                eventBillingService.postEventChargesToFolio(quote.getId());
            } else if (!group.isUsesRoomBlock()) {
                eventBillingService.postEventChargesToFolio(quote.getId());
            } else {
                log.warn(
                        "Quote {} contracted but charges not posted — link a master reservation on the group",
                        quote.getId());
            }
            try {
                eventBillingDocumentService.syncFromQuote(quote.getId());
            } catch (Exception ex) {
                log.warn("Could not create event billing document for quote {}: {}", quote.getId(), ex.getMessage());
            }
            return;
        }
        quoteRepository.save(quote);
    }

    private void assertTransition(EventQuoteStatus from, EventQuoteStatus to) {
        boolean ok = switch (from) {
            case DRAFT -> to == EventQuoteStatus.SENT || to == EventQuoteStatus.CANCELLED || to == EventQuoteStatus.ACCEPTED;
            case SENT -> to == EventQuoteStatus.ACCEPTED || to == EventQuoteStatus.CANCELLED;
            case ACCEPTED -> to == EventQuoteStatus.CONTRACTED || to == EventQuoteStatus.CANCELLED;
            case CONTRACTED -> to == EventQuoteStatus.CANCELLED;
            case CANCELLED -> false;
        };
        if (!ok) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "QUOTE_STATUS_TRANSITION",
                    "Cannot change quote from " + from + " to " + to + ". Follow: Draft → Mark sent → Mark accepted → Contract.");
        }
    }

    private void syncQuoteFromCatering(EventQuote quote, EventBooking event) {
        quote.getLines().removeIf(l -> l.getLineType() == EventQuoteLineType.CATERING);
        int pax = event.getGuaranteedPax() != null
                ? event.getGuaranteedPax()
                : event.getExpectedPax() != null ? event.getExpectedPax() : 1;
        List<EventCateringLine> catering = cateringLineRepository.findByEventBooking_IdOrderByCreatedAtAsc(event.getId());
        for (EventCateringLine cl : catering) {
            EventQuoteLine ql = new EventQuoteLine();
            ql.setEventQuote(quote);
            ql.setLineType(EventQuoteLineType.CATERING);
            ql.setDescription(cl.getDescription());
            ql.setQuantity(cl.getQuantity());
            ql.setUnitPrice(cl.getUnitPrice());
            ql.setLineTotal(cl.getLineTotal());
            ql.setTaxable(cl.isTaxable());
            quote.getLines().add(ql);
        }
        quoteRepository.save(quote);
        recalculateTotals(quote.getId());
    }

    private EventQuoteLine buildQuoteLine(EventQuote quote, EventOpsDtos.QuoteLineRequest lr) {
        EventQuoteLine line = new EventQuoteLine();
        line.setEventQuote(quote);
        line.setLineType(lr.lineType() != null ? lr.lineType() : EventQuoteLineType.OTHER);
        line.setDescription(lr.description().trim());
        line.setQuantity(lr.quantity().setScale(3, RoundingMode.HALF_UP));
        line.setUnitPrice(lr.unitPrice().setScale(2, RoundingMode.HALF_UP));
        line.setLineTotal(line.getQuantity().multiply(line.getUnitPrice()).setScale(2, RoundingMode.HALF_UP));
        line.setTaxable(lr.taxable() == null || lr.taxable());
        return line;
    }

    private void applyCateringLine(UUID hotelId, EventCateringLine line, EventOpsDtos.CateringLineRequest req) {
        if (req.cateringPackageId() == null && req.depotProductId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Either catering package or depot product is required");
        }
        if (req.cateringPackageId() != null && req.depotProductId() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provide only one of catering package or depot product");
        }
        EventBooking event = line.getEventBooking();
        BigDecimal qty = req.quantity().setScale(3, RoundingMode.HALF_UP);
        if (req.cateringPackageId() != null) {
            int pax = event.getGuaranteedPax() != null
                    ? event.getGuaranteedPax()
                    : event.getExpectedPax() != null ? event.getExpectedPax() : 1;
            if (qty.compareTo(BigDecimal.ONE) <= 0) {
                qty = BigDecimal.valueOf(Math.max(pax, 1));
            }
        }
        line.setQuantity(qty);
        if (req.cateringPackageId() != null) {
            EventCateringPackage pkg = packageRepository
                    .findByIdAndHotel_Id(req.cateringPackageId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Catering package not found"));
            line.setCateringPackage(pkg);
            line.setDepotProduct(null);
            line.setDescription(pkg.getPackageName());
            line.setUnitPrice(pkg.getPricePerPax().setScale(2, RoundingMode.HALF_UP));
            line.setTaxable(pkg.isTaxable());
        } else {
            DepotProduct product = depotProductRepository
                    .findByIdAndHotel_Id(req.depotProductId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Depot product not found"));
            line.setDepotProduct(product);
            line.setCateringPackage(null);
            line.setDescription(
                    req.description() != null && !req.description().isBlank()
                            ? req.description().trim()
                            : product.getProductName());
            line.setUnitPrice(
                    (req.unitPrice() != null ? req.unitPrice() : product.getSellingPrice())
                            .setScale(2, RoundingMode.HALF_UP));
            line.setTaxable(product.isTaxable());
        }
        line.setLineTotal(line.getQuantity().multiply(line.getUnitPrice()).setScale(2, RoundingMode.HALF_UP));
    }

    private EventBooking assertEvent(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return eventBookingRepository
                .findByIdAndHotel_IdAndGroupBooking_Id(eventId, hotelId, groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event not found"));
    }

    private EventQuote loadQuoteForEvent(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        assertEvent(hotelId, hotelHeader, groupId, eventId);
        return quoteRepository
                .findByEventBooking_Id(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quote not found"));
    }

    /** Hotel tax rate may be stored as 18 (percent) or 0.18 (fraction). */
    private static BigDecimal effectiveTaxFraction(BigDecimal taxRate) {
        if (taxRate == null || taxRate.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        if (taxRate.compareTo(BigDecimal.ONE) > 0) {
            return taxRate.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        }
        return taxRate;
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Quote not found");
    }

    private String blank(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private EventOpsDtos.CateringLineResponse toCateringLine(EventCateringLine line) {
        return new EventOpsDtos.CateringLineResponse(
                line.getId(),
                line.getCateringPackage() != null ? line.getCateringPackage().getId() : null,
                line.getCateringPackage() != null ? line.getCateringPackage().getPackageName() : null,
                line.getDepotProduct() != null ? line.getDepotProduct().getId() : null,
                line.getDepotProduct() != null ? line.getDepotProduct().getProductCode() : null,
                line.getDescription(),
                line.getQuantity(),
                line.getUnitPrice(),
                line.getLineTotal(),
                line.isTaxable());
    }

    private EventOpsDtos.QuoteResponse toQuoteResponse(EventQuote quote) {
        List<EventQuoteLine> lines = quoteLineRepository.findByEventQuote_IdOrderByCreatedAtAsc(quote.getId());
        return new EventOpsDtos.QuoteResponse(
                quote.getId(),
                quote.getEventBooking().getId(),
                quote.getGroupBooking().getId(),
                quote.getStatus(),
                quote.getSubtotal(),
                quote.getTaxAmount(),
                quote.getDiscountAmount(),
                quote.getTotalAmount(),
                quote.getDepositRequired(),
                quote.isDepositPaid(),
                quote.getValidUntil(),
                quote.getInternalNotes(),
                quote.getClientNotes(),
                quote.getChargesPostedAt(),
                quote.getChargesReversedAt(),
                lines.stream().map(this::toQuoteLine).toList());
    }

    private EventOpsDtos.QuoteLineResponse toQuoteLine(EventQuoteLine line) {
        return new EventOpsDtos.QuoteLineResponse(
                line.getId(),
                line.getLineType(),
                line.getDescription(),
                line.getQuantity(),
                line.getUnitPrice(),
                line.getLineTotal(),
                line.isTaxable(),
                line.getChargeReferenceId());
    }

    private EventBookingDtos.EventBookingResponse toEventResponse(EventBooking event) {
        return new EventBookingDtos.EventBookingResponse(
                event.getId(),
                event.getHotel().getId(),
                event.getGroupBooking().getId(),
                event.getEventName(),
                event.getEventType(),
                event.getStatus(),
                event.getStartDatetime(),
                event.getEndDatetime(),
                event.getSetupStyle(),
                event.getExpectedPax(),
                event.getGuaranteedPax(),
                event.getVenueOrFacilityId(),
                null,
                event.getCoordinatorNotes());
    }
}
