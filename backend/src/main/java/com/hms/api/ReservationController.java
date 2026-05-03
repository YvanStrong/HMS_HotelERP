package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.GuestDtos;
import com.hms.service.InvoiceService;
import com.hms.service.ReservationService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/reservations")
public class ReservationController {

    private final ReservationService reservationService;
    private final InvoiceService invoiceService;

    public ReservationController(ReservationService reservationService, InvoiceService invoiceService) {
        this.reservationService = reservationService;
        this.invoiceService = invoiceService;
    }

    @GetMapping("/availability")
    public ApiDtos.AvailabilityResponse availability(
            @PathVariable UUID hotelId,
            @RequestParam LocalDate checkIn,
            @RequestParam LocalDate checkOut,
            @RequestParam(defaultValue = "2") int adults,
            @RequestParam(defaultValue = "0") int children,
            @RequestParam(required = false) UUID roomTypeId) {
        return reservationService.availability(hotelId, checkIn, checkOut, adults, children, roomTypeId);
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.ReservationListItem> listReservations(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate stayStart,
            @RequestParam(required = false) LocalDate stayEnd,
            @RequestParam(name = "check_in_from", required = false) LocalDate checkInFrom,
            @RequestParam(name = "check_in_to", required = false) LocalDate checkInTo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q) {
        LocalDate from = checkInFrom != null ? checkInFrom : stayStart;
        LocalDate to = checkInTo != null ? checkInTo : stayEnd;
        return reservationService.listReservationsForHotel(hotelId, hotelHeader, from, to, status, q);
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST','ROLE_CORPORATE_BOOKER')")
    public ResponseEntity<ApiDtos.CreateReservationResponse> createReservation(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.CreateReservationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reservationService.createReservation(hotelId, hotelHeader, request));
    }

    @PostMapping("/{reservationId}/cancel")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ApiDtos.CancelReservationResponse cancelReservation(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) ApiDtos.CancelReservationRequest request) {
        return reservationService.cancelReservation(hotelId, hotelHeader, reservationId, request);
    }

    @PostMapping("/{reservationId}/apply-guest-preferences")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public GuestDtos.ApplyGuestPreferencesResponse applyGuestPreferences(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) GuestDtos.ApplyGuestPreferencesRequest request) {
        return reservationService.applyGuestPreferences(hotelId, hotelHeader, reservationId, request);
    }

    @PostMapping("/{reservationId}/check-in")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ApiDtos.CheckInResponse checkIn(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) ApiDtos.CheckInRequest request) {
        ApiDtos.CheckInRequest body =
                request != null
                        ? request
                        : new ApiDtos.CheckInRequest(null, null, null, null, null, null, null);
        return reservationService.checkIn(hotelId, hotelHeader, reservationId, body);
    }

    @PostMapping("/{reservationId}/check-out")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.CheckOutResponse checkOut(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) ApiDtos.CheckOutRequest request) {
        ApiDtos.CheckOutRequest body =
                request != null
                        ? request
                        : new ApiDtos.CheckOutRequest(null, null, null, null, null, null, null);
        return reservationService.checkOut(hotelId, hotelHeader, reservationId, body);
    }

    @PostMapping("/{reservationId}/no-show")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ApiDtos.NoShowResponse markNoShow(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reservationService.markNoShow(hotelId, hotelHeader, reservationId);
    }

    @GetMapping("/{reservationId}/assignment-suggestions")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.AssignmentSuggestionRoom> assignmentSuggestions(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reservationService.assignmentSuggestions(hotelId, hotelHeader, reservationId);
    }

    @GetMapping("/{reservationId}/staff-detail")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public GuestDtos.StaffReservationDetailResponse staffReservationDetail(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reservationService.getStaffReservationDetail(hotelId, hotelHeader, reservationId);
    }

    @GetMapping("/{reservationId}/folio")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE','ROLE_GUEST')")
    public ApiDtos.FolioResponse folio(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reservationService.getFolio(hotelId, hotelHeader, reservationId);
    }

    @PostMapping("/{reservationId}/charges")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.FolioResponse postReservationCharge(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.ReservationChargePostRequest body) {
        return reservationService.postReservationCharge(hotelId, hotelHeader, reservationId, body);
    }

    @PostMapping("/{reservationId}/payments")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.FolioResponse addPayment(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.PaymentCreateRequest body) {
        return reservationService.addPayment(hotelId, hotelHeader, reservationId, body);
    }

    @GetMapping("/{reservationId}/payments")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.FolioPaymentLine> listPayments(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reservationService.listPayments(hotelId, hotelHeader, reservationId);
    }

    @DeleteMapping("/{reservationId}/payments/{paymentId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ApiDtos.FolioResponse voidPayment(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @PathVariable UUID paymentId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.PaymentVoidRequest body) {
        return reservationService.voidPayment(hotelId, hotelHeader, reservationId, paymentId, body);
    }

    @GetMapping("/{reservationId}/final-invoice")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<ApiDtos.InvoiceDto> finalInvoiceForReservation(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invoiceService
                .finalInvoiceForReservation(hotelId, hotelHeader, reservationId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{reservationId}/invoice")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ResponseEntity<byte[]> invoicePdf(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        byte[] pdf = reservationService.generateInvoicePdf(hotelId, hotelHeader, reservationId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"invoice-" + reservationId + ".pdf\"");
        return new ResponseEntity<>(pdf, headers, HttpStatus.OK);
    }
}
