package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.ReservationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Canonical folio API surface; delegates to {@link ReservationService} (same behavior as
 * {@code /api/v1/hotels/{hotelId}/reservations/{reservationId}/folio}).
 */
@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/folios")
@RequiredArgsConstructor
public class FolioController {

    private final ReservationService reservationService;

    @GetMapping("/{reservationId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE','ROLE_GUEST')")
    public ApiDtos.FolioResponse getFolio(
            @PathVariable UUID hotelId,
            @PathVariable UUID reservationId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return reservationService.getFolio(hotelId, hotelHeader, reservationId);
    }

    @PostMapping("/{reservationId}/charges")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.FolioResponse postCharge(
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
}
