package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.ReservationService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/hotels/{hotelId}/reservations")
public class PublicReservationController {

    private final ReservationService reservationService;

    public PublicReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
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

    @PostMapping("/book")
    public ResponseEntity<ApiDtos.CreateReservationResponse> book(
            @PathVariable UUID hotelId,
            Authentication authentication,
            @Valid @RequestBody ApiDtos.CreateReservationRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reservationService.createReservationForPublic(hotelId, body, authentication));
    }

    @GetMapping("/lookup")
    public ApiDtos.PublicReservationLookupResponse lookup(
            @PathVariable UUID hotelId,
            @RequestParam String confirmation,
            @RequestParam String email) {
        return reservationService.lookupReservationPublic(hotelId, confirmation, email);
    }
}
