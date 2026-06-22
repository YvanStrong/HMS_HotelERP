package com.hms.api;

import com.hms.security.CheckModuleEntitlement;
import com.hms.security.PosStaffRoles;
import com.hms.service.PushNotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/staff")
@CheckModuleEntitlement("RESTAURANT_POS")
@RequiredArgsConstructor
public class StaffPushController {

    private final PushNotificationService pushNotificationService;

    public record RegisterPushTokenRequest(
            @NotBlank String token, String deviceId, @NotBlank String platform) {}

    public record SetActiveDepotRequest(UUID depotId) {}

    @PostMapping("/push-token")
    @PreAuthorize(PosStaffRoles.ANY)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void register(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody RegisterPushTokenRequest body) {
        pushNotificationService.registerToken(
                hotelId, hotelHeader, body.token(), body.deviceId(), body.platform());
    }

    @DeleteMapping("/push-token")
    @PreAuthorize(PosStaffRoles.ANY)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String deviceId) {
        pushNotificationService.deactivateToken(hotelId, hotelHeader, deviceId);
    }

    @PatchMapping("/active-depot")
    @PreAuthorize(PosStaffRoles.ANY)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setActiveDepot(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody SetActiveDepotRequest body) {
        pushNotificationService.setActiveDepot(hotelId, hotelHeader, body.depotId());
    }
}
