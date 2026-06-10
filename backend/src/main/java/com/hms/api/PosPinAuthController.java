package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.PosPinAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/auth/pos")
@RequiredArgsConstructor
public class PosPinAuthController {

    private final PosPinAuthService posPinAuthService;

    public record SetPinRequest(@NotBlank String pin) {}

    public record PinLoginRequest(@NotBlank String email, @NotBlank String pin) {}

    public record HasPinResponse(boolean hasPin) {}

    @PostMapping("/set-pin")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> setPin(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody SetPinRequest body) {
        posPinAuthService.setPin(hotelId, hotelHeader, body.pin());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/pin-login")
    public ResponseEntity<ApiDtos.LoginResponse> pinLogin(
            @PathVariable UUID hotelId,
            @Valid @RequestBody PinLoginRequest body,
            HttpServletRequest request) {
        return ResponseEntity.ok(posPinAuthService.pinLogin(hotelId, body.email(), body.pin(), request));
    }

    @PostMapping("/pin-unlock")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiDtos.LoginResponse> pinUnlock(
            @PathVariable UUID hotelId,
            @Valid @RequestBody PinLoginRequest body,
            HttpServletRequest request) {
        return ResponseEntity.ok(posPinAuthService.pinUnlock(hotelId, body.email(), body.pin(), request));
    }

    @GetMapping("/has-pin")
    @PreAuthorize("isAuthenticated()")
    public HasPinResponse hasPin(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return new HasPinResponse(posPinAuthService.hasPin(hotelId, hotelHeader));
    }
}
