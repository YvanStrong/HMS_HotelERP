package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.InvoiceService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.InvoiceListItem> listInvoices(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invoiceService.listInvoices(hotelId, hotelHeader);
    }

    @GetMapping("/{invoiceId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.InvoiceDto invoiceById(
            @PathVariable UUID hotelId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invoiceService.invoiceById(hotelId, hotelHeader, invoiceId);
    }

    @GetMapping("/proformas")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.ProformaInvoiceListItem> listProformas(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invoiceService.listProformas(hotelId, hotelHeader);
    }

    @GetMapping("/proformas/{reservationId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.ProformaInvoiceDto proformaByReservation(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invoiceService.proformaByReservation(hotelId, hotelHeader, reservationId);
    }
}
