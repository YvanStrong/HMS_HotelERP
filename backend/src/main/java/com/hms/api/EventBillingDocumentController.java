package com.hms.api;

import com.hms.api.dto.EventOpsDtos;
import com.hms.security.CheckModuleEntitlement;
import com.hms.service.EventBillingDocumentService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/event-billing-documents")
@RequiredArgsConstructor
public class EventBillingDocumentController {

    private final EventBillingDocumentService eventBillingDocumentService;

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<EventOpsDtos.EventBillingDocumentRow> list(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return eventBillingDocumentService.listByHotel(hotelId, hotelHeader);
    }

    @GetMapping("/{documentId}/pdf")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<byte[]> downloadPdf(
            @PathVariable UUID hotelId,
            @PathVariable UUID documentId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        byte[] pdf = eventBillingDocumentService.pdfBytes(hotelId, hotelHeader, documentId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"event-billing-" + documentId + ".pdf\"");
        return ResponseEntity.ok().headers(headers).body(pdf);
    }
}
