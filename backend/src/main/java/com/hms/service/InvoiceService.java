package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.config.HmsPublicUrlProperties;
import com.hms.domain.ReservationStatus;
import com.hms.entity.Hotel;
import com.hms.entity.Invoice;
import com.hms.entity.InvoiceLineItem;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.entity.RoomCharge;
import com.hms.entity.RoomType;
import com.hms.repository.InvoiceRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomChargeRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.Year;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceService {

    private static final BigDecimal TAX_RATE = new BigDecimal("0.15");

    private final TenantAccessService tenantAccessService;
    private final InvoiceRepository invoiceRepository;
    private final ReservationRepository reservationRepository;
    private final RoomChargeRepository roomChargeRepository;
    private final HmsPublicUrlProperties publicUrlProperties;
    private final InvoicePdfService invoicePdfService;

    public InvoiceService(
            TenantAccessService tenantAccessService,
            InvoiceRepository invoiceRepository,
            ReservationRepository reservationRepository,
            RoomChargeRepository roomChargeRepository,
            HmsPublicUrlProperties publicUrlProperties,
            InvoicePdfService invoicePdfService) {
        this.tenantAccessService = tenantAccessService;
        this.invoiceRepository = invoiceRepository;
        this.reservationRepository = reservationRepository;
        this.roomChargeRepository = roomChargeRepository;
        this.publicUrlProperties = publicUrlProperties;
        this.invoicePdfService = invoicePdfService;
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.InvoiceListItem> listInvoices(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<Invoice> invoices = invoiceRepository.findDetailedByHotelIdOrderByCreatedAtDesc(hotelId);
        return invoices.stream()
                .map(i -> new ApiDtos.InvoiceListItem(
                        i.getId(),
                        i.getInvoiceNumber(),
                        i.getReservation().getConfirmationCode(),
                        i.getReservation().getBookingReference(),
                        guestName(i.getReservation()),
                        i.getReservation().getRoom() != null
                                ? i.getReservation().getRoom().getRoomNumber()
                                : null,
                        i.getTotalAmount(),
                        i.getHotel().getCurrency(),
                        i.getCreatedAt(),
                        publicUrlProperties.invoicePdfUrl(hotelId, i.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public ApiDtos.InvoiceDto invoiceById(UUID hotelId, String hotelHeader, UUID invoiceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Invoice inv = invoiceRepository
                .findDetailedByIdAndHotelId(invoiceId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Invoice not found"));
        return toInvoiceDto(hotelId, inv, null);
    }

    @Transactional(readOnly = true)
    public Optional<ApiDtos.InvoiceDto> finalInvoiceForReservation(
            UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (!reservationRepository.findByIdAndHotel_Id(reservationId, hotelId).isPresent()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        return invoiceRepository
                .findTopByReservation_IdAndHotel_IdOrderByCreatedAtDesc(reservationId, hotelId)
                .flatMap(inv -> invoiceRepository.findDetailedByIdAndHotelId(inv.getId(), hotelId))
                .map(inv -> toInvoiceDto(hotelId, inv, null));
    }

    /**
     * Maps a persisted invoice to API DTO. When {@code precomputedLines} is non-null (e.g. checkout response), those
     * lines are used instead of reading {@link Invoice#getLineItems()}.
     */
    public ApiDtos.InvoiceDto toInvoiceDto(UUID hotelId, Invoice inv, List<ApiDtos.InvoiceLine> precomputedLines) {
        List<ApiDtos.InvoiceLine> lines =
                precomputedLines != null ? precomputedLines : mapInvoiceLinesFromEntity(inv);
        Reservation res = inv.getReservation();
        String roomNumber = null;
        String roomTypeName = null;
        if (res != null) {
            Room rm = res.getRoom();
            if (rm != null) {
                roomNumber = rm.getRoomNumber();
                RoomType rt = rm.getRoomType();
                if (rt != null) {
                    roomTypeName = rt.getName();
                }
            }
        }
        Hotel hotel = inv.getHotel();
        String bookingRef = res != null ? blankToDash(res.getBookingReference()) : "-";
        String confCode = res != null ? blankToDash(res.getConfirmationCode()) : "-";
        String guest = res != null ? guestName(res) : "Guest";
        String currency = hotel != null && hotel.getCurrency() != null ? hotel.getCurrency() : "USD";
        Instant createdAt = inv.getCreatedAt() != null ? inv.getCreatedAt() : Instant.now();
        return new ApiDtos.InvoiceDto(
                inv.getId(),
                inv.getInvoiceNumber(),
                inv.getTotalAmount(),
                publicUrlProperties.invoicePdfUrl(hotelId, inv.getId()),
                lines,
                bookingRef,
                confCode,
                guest,
                roomNumber,
                roomTypeName,
                currency,
                createdAt);
    }

    private static List<ApiDtos.InvoiceLine> mapInvoiceLinesFromEntity(Invoice inv) {
        List<InvoiceLineItem> raw = inv.getLineItems();
        if (raw == null) {
            return List.of();
        }
        return raw.stream()
                .sorted(Comparator.comparing(li -> li.getLineOrder() != null ? li.getLineOrder() : 0))
                .map(li -> new ApiDtos.InvoiceLine(li.getDescription(), li.getAmount()))
                .toList();
    }

    private static String blankToDash(String s) {
        return s == null || s.isBlank() ? "-" : s;
    }

    @Transactional(readOnly = true)
    public byte[] invoicePdfBytes(UUID hotelId, String hotelHeader, UUID invoiceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Invoice inv = invoiceRepository
                .findDetailedByIdAndHotelId(invoiceId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Invoice not found"));
        return invoicePdfService.renderStoredTaxInvoice(inv);
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.ProformaInvoiceListItem> listProformas(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<Reservation> rows = reservationRepository.findByHotel_IdAndStatusIn(
                hotelId, List.of(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN));
        Instant now = Instant.now();
        List<ApiDtos.ProformaInvoiceListItem> out = new ArrayList<>();
        for (Reservation r : rows) {
            List<RoomCharge> charges = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId());
            Totals totals = computeTotals(r, charges);
            out.add(new ApiDtos.ProformaInvoiceListItem(
                    r.getId(),
                    proformaNumber(r),
                    r.getConfirmationCode(),
                    r.getBookingReference(),
                    guestName(r),
                    r.getStatus().name(),
                    totals.grandTotal(),
                    r.getHotel().getCurrency(),
                    now));
        }
        return out.stream()
                .sorted(Comparator.comparing(ApiDtos.ProformaInvoiceListItem::generatedAt).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public ApiDtos.ProformaInvoiceDto proformaByReservation(UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        List<RoomCharge> charges = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId());
        long nights = ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate());
        List<ApiDtos.InvoiceLine> lines = new ArrayList<>();
        lines.add(new ApiDtos.InvoiceLine(
                "Room (" + nights + " nights @ " + r.getNightlyRate() + ")", scale(r.getTotalAmount())));
        for (RoomCharge c : charges) {
            lines.add(new ApiDtos.InvoiceLine(c.getDescription(), scale(c.getAmount())));
        }
        Totals totals = computeTotals(r, charges);
        lines.add(new ApiDtos.InvoiceLine("Tax (15%)", totals.taxes()));
        if (totals.depositCredit().signum() > 0) {
            lines.add(new ApiDtos.InvoiceLine("Deposit Paid", totals.depositCredit().negate()));
        }
        return new ApiDtos.ProformaInvoiceDto(
                r.getId(),
                proformaNumber(r),
                r.getConfirmationCode(),
                r.getBookingReference(),
                r.getStatus().name(),
                guestName(r),
                r.getRoom() != null ? r.getRoom().getRoomNumber() : null,
                r.getCheckInDate(),
                r.getCheckOutDate(),
                totals.subtotal(),
                totals.taxes(),
                totals.depositCredit(),
                totals.grandTotal(),
                r.getHotel().getCurrency(),
                Instant.now(),
                lines);
    }

    private Totals computeTotals(Reservation r, List<RoomCharge> charges) {
        BigDecimal roomLine = scale(r.getTotalAmount());
        BigDecimal extras = charges.stream().map(RoomCharge::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal subtotal = roomLine.add(scale(extras));
        BigDecimal taxes = scale(subtotal.multiply(TAX_RATE));
        BigDecimal deposit = r.isDepositPaid() && r.getDepositAmount() != null ? scale(r.getDepositAmount()) : BigDecimal.ZERO;
        BigDecimal grand = scale(subtotal.add(taxes).subtract(deposit));
        return new Totals(subtotal, taxes, deposit, grand);
    }

    private static BigDecimal scale(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String proformaNumber(Reservation r) {
        String year = Integer.toString(Year.now().getValue());
        String suffix = (r.getBookingReference() != null && !r.getBookingReference().isBlank())
                ? r.getBookingReference().replace("HMS-", "")
                : r.getId().toString().substring(0, 8).toUpperCase();
        return "PF-" + year + "-" + suffix;
    }

    private static String guestName(Reservation r) {
        if (r.getGuest() == null) return "Guest";
        if (r.getGuest().getFullName() != null && !r.getGuest().getFullName().isBlank()) {
            return r.getGuest().getFullName();
        }
        return ((r.getGuest().getFirstName() != null ? r.getGuest().getFirstName() : "") + " "
                        + (r.getGuest().getLastName() != null ? r.getGuest().getLastName() : ""))
                .trim();
    }

    private record Totals(BigDecimal subtotal, BigDecimal taxes, BigDecimal depositCredit, BigDecimal grandTotal) {}
}
