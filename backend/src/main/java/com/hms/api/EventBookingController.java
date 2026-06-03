package com.hms.api;

import com.hms.api.dto.EventBookingDtos;
import com.hms.api.dto.EventOpsDtos;
import com.hms.security.CheckModuleEntitlement;
import com.hms.service.BanquetEventOrderService;
import com.hms.service.EventBillingDocumentService;
import com.hms.service.EventBillingService;
import com.hms.service.EventBookingService;
import com.hms.service.EventDocumentPdfService;
import com.hms.service.EventQuoteService;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/groups/{groupId}/events")
@CheckModuleEntitlement("GROUPS_EVENTS")
@RequiredArgsConstructor
public class EventBookingController {

    private final EventBookingService eventBookingService;
    private final EventQuoteService eventQuoteService;
    private final BanquetEventOrderService banquetEventOrderService;
    private final EventBillingService eventBillingService;
    private final EventBillingDocumentService eventBillingDocumentService;
    private final EventDocumentPdfService eventDocumentPdfService;

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<EventOpsDtos.EventListItem> listEvents(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBookingService.listEnrichedByGroup(hotelId, hotelHeader, groupId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventBookingDtos.EventBookingResponse createEvent(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody EventBookingDtos.EventBookingRequest body) {
        return eventBookingService.create(hotelId, hotelHeader, groupId, body);
    }

    @GetMapping("/conflicts")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public EventBookingDtos.EventConflictResponse checkConflict(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID venueOrFacilityId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDatetime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDatetime,
            @RequestParam(required = false) UUID excludeEventId) {
        return eventBookingService.conflictCheck(
                hotelId, hotelHeader, groupId, venueOrFacilityId, startDatetime, endDatetime, excludeEventId);
    }

    @GetMapping("/{eventId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public EventBookingDtos.EventBookingResponse getEvent(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBookingService.detail(hotelId, hotelHeader, groupId, eventId);
    }

    @PutMapping("/{eventId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventBookingDtos.EventBookingResponse updateEvent(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody EventBookingDtos.EventBookingRequest body) {
        return eventBookingService.update(hotelId, hotelHeader, groupId, eventId, body);
    }

    @PostMapping("/{eventId}/cancel")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventBookingDtos.EventBookingResponse cancelEvent(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBookingService.cancel(hotelId, hotelHeader, groupId, eventId);
    }

    @GetMapping("/{eventId}/catering-lines")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<EventOpsDtos.CateringLineResponse> listCateringLines(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventQuoteService.listCateringLines(hotelId, hotelHeader, groupId, eventId);
    }

    @PostMapping("/{eventId}/catering-lines")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventOpsDtos.CateringLineResponse addCateringLine(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody EventOpsDtos.CateringLineRequest body) {
        return eventQuoteService.addCateringLine(hotelId, hotelHeader, groupId, eventId, body);
    }

    @DeleteMapping("/{eventId}/catering-lines/{lineId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public void deleteCateringLine(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @PathVariable UUID lineId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        eventQuoteService.removeCateringLine(hotelId, hotelHeader, groupId, eventId, lineId);
    }

    @GetMapping("/{eventId}/quote")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<EventOpsDtos.QuoteResponse> getQuote(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventQuoteService
                .findQuote(hotelId, hotelHeader, groupId, eventId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/{eventId}/quote/pdf")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<byte[]> downloadQuotePdf(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        byte[] pdf = eventBillingDocumentService.pdfBytesForEvent(hotelId, hotelHeader, groupId, eventId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"event-billing-" + eventId + ".pdf\"");
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/{eventId}/billing-document/pdf")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<byte[]> downloadBillingDocumentPdf(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return downloadQuotePdf(hotelId, groupId, eventId, hotelHeader);
    }

    @GetMapping("/{eventId}/quote/print")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public EventOpsDtos.PrintableQuoteResponse getPrintableQuote(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventQuoteService.getPrintableQuote(hotelId, hotelHeader, groupId, eventId);
    }

    @PostMapping("/{eventId}/quote")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventOpsDtos.QuoteResponse createQuote(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventQuoteService.createDraft(hotelId, hotelHeader, groupId, eventId);
    }

    @PatchMapping("/{eventId}/quote")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public EventOpsDtos.QuoteResponse patchQuote(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody EventOpsDtos.QuotePatchRequest body) {
        return eventQuoteService.patchQuote(hotelId, hotelHeader, groupId, eventId, body);
    }

    @PostMapping("/{eventId}/quote/accept")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public EventOpsDtos.QuoteResponse acceptQuote(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventQuoteService.acceptQuote(hotelId, hotelHeader, groupId, eventId);
    }

    @PostMapping("/{eventId}/quote/post-charges")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public void postCharges(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        EventOpsDtos.QuoteResponse quote = eventQuoteService.getQuote(hotelId, hotelHeader, groupId, eventId);
        eventBillingService.postEventChargesToFolio(quote.id());
    }

    @PostMapping("/{eventId}/quote/reverse-charges")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public void reverseCharges(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        EventOpsDtos.QuoteResponse quote = eventQuoteService.getQuote(hotelId, hotelHeader, groupId, eventId);
        eventBillingService.reverseEventCharges(quote.id());
    }

    @PostMapping("/{eventId}/beo")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventOpsDtos.BeoResponse generateBeo(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return banquetEventOrderService.generateBEO(hotelId, hotelHeader, groupId, eventId);
    }

    @GetMapping("/{eventId}/beo")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public EventOpsDtos.BeoResponse getBeo(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return banquetEventOrderService.getBeo(hotelId, hotelHeader, groupId, eventId);
    }

    @GetMapping("/{eventId}/beo/pdf")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<byte[]> downloadBeoPdf(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        byte[] pdf = eventDocumentPdfService.renderBeoPdf(
                banquetEventOrderService.getFullBEO(hotelId, hotelHeader, groupId, eventId));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"banquet-order-" + eventId + ".pdf\"");
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/{eventId}/beo/full")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public EventOpsDtos.FullBeoResponse getFullBeo(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return banquetEventOrderService.getFullBEO(hotelId, hotelHeader, groupId, eventId);
    }

    @PatchMapping("/{eventId}/beo")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventOpsDtos.BeoResponse patchBeo(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody EventOpsDtos.BeoSectionUpdateRequest body) {
        return banquetEventOrderService.updateSection(hotelId, hotelHeader, groupId, eventId, body);
    }

    @PostMapping("/{eventId}/beo/revise")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventOpsDtos.BeoResponse reviseBeo(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return banquetEventOrderService.revise(hotelId, hotelHeader, groupId, eventId);
    }

    @PostMapping("/{eventId}/beo/status")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public EventOpsDtos.BeoResponse transitionBeo(
            @PathVariable UUID hotelId,
            @PathVariable UUID groupId,
            @PathVariable UUID eventId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody EventOpsDtos.BeoStatusRequest body) {
        return banquetEventOrderService.transition(hotelId, hotelHeader, groupId, eventId, body.newStatus());
    }
}
