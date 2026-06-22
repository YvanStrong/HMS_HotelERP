package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.InventoryDepotDtos;
import com.hms.domain.FacilityPaymentStatus;
import com.hms.entity.DepotSaleRefund;
import com.hms.entity.FacilityBooking;
import com.hms.entity.Hotel;
import com.hms.entity.HotelInvoiceRefund;
import com.hms.entity.Invoice;
import com.hms.repository.DepotSaleRefundRepository;
import com.hms.repository.FacilityBookingRepository;
import com.hms.repository.HotelInvoiceRefundRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InvoiceRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UnifiedInvoiceRefundService {

    private final TenantAccessService tenantAccessService;
    private final HotelRepository hotelRepository;
    private final InvoiceRepository invoiceRepository;
    private final FacilityBookingRepository facilityBookingRepository;
    private final HotelInvoiceRefundRepository hotelInvoiceRefundRepository;
    private final DepotSaleRefundRepository depotSaleRefundRepository;
    private final InventoryDepotService inventoryDepotService;

    public UnifiedInvoiceRefundService(
            TenantAccessService tenantAccessService,
            HotelRepository hotelRepository,
            InvoiceRepository invoiceRepository,
            FacilityBookingRepository facilityBookingRepository,
            HotelInvoiceRefundRepository hotelInvoiceRefundRepository,
            DepotSaleRefundRepository depotSaleRefundRepository,
            InventoryDepotService inventoryDepotService) {
        this.tenantAccessService = tenantAccessService;
        this.hotelRepository = hotelRepository;
        this.invoiceRepository = invoiceRepository;
        this.facilityBookingRepository = facilityBookingRepository;
        this.hotelInvoiceRefundRepository = hotelInvoiceRefundRepository;
        this.depotSaleRefundRepository = depotSaleRefundRepository;
        this.inventoryDepotService = inventoryDepotService;
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.UnifiedRefundRow> listAllRefunds(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<ApiDtos.UnifiedRefundRow> rows = new ArrayList<>();
        for (DepotSaleRefund r : depotSaleRefundRepository.findByHotelIdOrderByCreatedAtDesc(hotelId)) {
            rows.add(new ApiDtos.UnifiedRefundRow(
                    r.getId(),
                    r.getRefundNumber(),
                    "POS",
                    r.getSale().getId(),
                    r.getSale().getSaleNumber(),
                    r.getSale().getCustomerName(),
                    r.getSale().getDepot().getName(),
                    r.getRefundAmount(),
                    r.getRefundMethod(),
                    r.getReason(),
                    r.getCreatedAt(),
                    r.getCreatedBy()));
        }
        for (HotelInvoiceRefund r : hotelInvoiceRefundRepository.findByHotelIdOrderByCreatedAtDesc(hotelId)) {
            String customer = null;
            String reference = null;
            if ("RESERVATION".equals(r.getSourceType())) {
                Invoice inv = invoiceRepository.findDetailedByIdAndHotelId(r.getSourceId(), hotelId).orElse(null);
                if (inv != null) {
                    customer = guestName(inv);
                    reference = inv.getReservation().getBookingReference();
                }
            } else if ("FACILITY".equals(r.getSourceType())) {
                FacilityBooking b = facilityBookingRepository.findById(r.getSourceId()).orElse(null);
                if (b != null && b.getGuest() != null && b.getFacility() != null) {
                    customer = b.getGuest().getFullName();
                    reference = b.getFacility().getName();
                }
            }
            rows.add(new ApiDtos.UnifiedRefundRow(
                    r.getId(),
                    r.getRefundNumber(),
                    r.getSourceType(),
                    r.getSourceId(),
                    r.getSourceNumber(),
                    customer,
                    reference,
                    r.getRefundAmount(),
                    r.getRefundMethod(),
                    r.getReason(),
                    r.getCreatedAt(),
                    r.getCreatedBy()));
        }
        rows.sort(Comparator.comparing(ApiDtos.UnifiedRefundRow::refundedAt).reversed());
        return rows;
    }

    @Transactional
    public ApiDtos.UnifiedRefundRow refundReservationInvoice(
            UUID hotelId, String hotelHeader, UUID invoiceId, ApiDtos.CreateInvoiceRefundRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Invoice inv = invoiceRepository
                .findDetailedByIdAndHotelId(invoiceId, hotelId)
                .orElseThrow(() -> notFound("Invoice"));
        if ("REFUNDED".equalsIgnoreCase(inv.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Invoice is already refunded");
        }
        if (hotelInvoiceRefundRepository.existsBySourceTypeAndSourceIdAndHotel_Id("RESERVATION", invoiceId, hotelId)) {
            throw new ApiException(HttpStatus.CONFLICT, "A refund already exists for this invoice");
        }
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String who = tenantAccessService.currentUser().getUsername();
        HotelInvoiceRefund refund = new HotelInvoiceRefund();
        refund.setHotel(hotel);
        refund.setSourceType("RESERVATION");
        refund.setSourceId(invoiceId);
        refund.setSourceNumber(inv.getInvoiceNumber());
        refund.setRefundNumber(nextRefundNumber(hotelId));
        refund.setRefundAmount(inv.getTotalAmount());
        refund.setRefundMethod(guessPaymentMethod(inv));
        refund.setReason(req != null && req.reason() != null ? req.reason().trim() : null);
        refund.setCreatedBy(who);
        inv.setStatus("REFUNDED");
        invoiceRepository.save(inv);
        refund = hotelInvoiceRefundRepository.save(refund);
        return new ApiDtos.UnifiedRefundRow(
                refund.getId(),
                refund.getRefundNumber(),
                "RESERVATION",
                invoiceId,
                inv.getInvoiceNumber(),
                guestName(inv),
                inv.getReservation().getBookingReference(),
                refund.getRefundAmount(),
                refund.getRefundMethod(),
                refund.getReason(),
                refund.getCreatedAt(),
                refund.getCreatedBy());
    }

    @Transactional
    public ApiDtos.UnifiedRefundRow refundFacilityInvoice(
            UUID hotelId, String hotelHeader, UUID bookingId, ApiDtos.CreateInvoiceRefundRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FacilityBooking booking = facilityBookingRepository
                .findById(bookingId)
                .filter(b -> b.getFacility().getHotel().getId().equals(hotelId))
                .orElseThrow(() -> notFound("Facility booking"));
        if (booking.getInvoiceNumber() == null || booking.getInvoiceNumber().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Booking has no invoice to refund");
        }
        if (booking.getPaymentStatus() == FacilityPaymentStatus.REFUNDED) {
            throw new ApiException(HttpStatus.CONFLICT, "Facility invoice is already refunded");
        }
        if (hotelInvoiceRefundRepository.existsBySourceTypeAndSourceIdAndHotel_Id("FACILITY", bookingId, hotelId)) {
            throw new ApiException(HttpStatus.CONFLICT, "A refund already exists for this invoice");
        }
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String who = tenantAccessService.currentUser().getUsername();
        BigDecimal amount = booking.getAmountPaid() != null ? booking.getAmountPaid() : BigDecimal.ZERO;
        HotelInvoiceRefund refund = new HotelInvoiceRefund();
        refund.setHotel(hotel);
        refund.setSourceType("FACILITY");
        refund.setSourceId(bookingId);
        refund.setSourceNumber(booking.getInvoiceNumber());
        refund.setRefundNumber(nextRefundNumber(hotelId));
        refund.setRefundAmount(amount);
        refund.setRefundMethod("CASH");
        refund.setReason(req != null && req.reason() != null ? req.reason().trim() : null);
        refund.setCreatedBy(who);
        booking.setPaymentStatus(FacilityPaymentStatus.REFUNDED);
        facilityBookingRepository.save(booking);
        refund = hotelInvoiceRefundRepository.save(refund);
        return new ApiDtos.UnifiedRefundRow(
                refund.getId(),
                refund.getRefundNumber(),
                "FACILITY",
                bookingId,
                booking.getInvoiceNumber(),
                booking.getGuest().getFullName(),
                booking.getFacility().getName(),
                refund.getRefundAmount(),
                refund.getRefundMethod(),
                refund.getReason(),
                refund.getCreatedAt(),
                refund.getCreatedBy());
    }

    @Transactional
    public InventoryDepotDtos.RefundResponse refundPosSale(
            UUID hotelId, String hotelHeader, UUID saleId, InventoryDepotDtos.CreateRefundRequest req) {
        return inventoryDepotService.refundSaleFull(
                hotelId, hotelHeader, saleId, req != null ? req : new InventoryDepotDtos.CreateRefundRequest(null));
    }

    private String nextRefundNumber(UUID hotelId) {
        long depotCount = depotSaleRefundRepository.countByHotelId(hotelId);
        long hotelCount = hotelInvoiceRefundRepository.countByHotelId(hotelId);
        long next = depotCount + hotelCount + 1;
        return "DR-" + Year.now().getValue() + "-" + String.format("%06d", next);
    }

    private static String guestName(Invoice inv) {
        if (inv.getReservation() == null || inv.getReservation().getGuest() == null) {
            return "Guest";
        }
        return inv.getReservation().getGuest().getFullName();
    }

    private static String guessPaymentMethod(Invoice inv) {
        return inv.getLineItems().stream()
                .map(li -> li.getDescription())
                .filter(d -> d != null && d.toLowerCase().contains("payment received"))
                .findFirst()
                .map(d -> {
                    int open = d.indexOf('(');
                    int close = d.indexOf(')');
                    if (open >= 0 && close > open) {
                        return d.substring(open + 1, close).trim();
                    }
                    return "CASH";
                })
                .orElse("CASH");
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
