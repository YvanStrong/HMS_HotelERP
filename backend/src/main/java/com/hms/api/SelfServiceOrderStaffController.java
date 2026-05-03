package com.hms.api;

import com.hms.api.dto.SelfOrderDtos;
import com.hms.service.SelfOrderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/inventory/self-service-orders")
public class SelfServiceOrderStaffController {

    private final SelfOrderService selfOrderService;

    public SelfServiceOrderStaffController(SelfOrderService selfOrderService) {
        this.selfOrderService = selfOrderService;
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public List<SelfOrderDtos.StaffOrderRow> list(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return selfOrderService.listStaffOrders(hotelId, hotelHeader);
    }

    @GetMapping("/settings")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public SelfOrderDtos.StaffSelfOrderSettings getSettings(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return selfOrderService.getSelfOrderSettings(hotelId, hotelHeader);
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public SelfOrderDtos.StaffSelfOrderSettings putSettings(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody SelfOrderDtos.PatchSelfOrderSettingsRequest body) {
        return selfOrderService.updateSelfOrderSettings(hotelId, hotelHeader, body);
    }

    @PostMapping("/{orderId}/confirm-payment")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public SelfOrderDtos.StaffOrderRow confirmPayment(
            @PathVariable UUID hotelId,
            @PathVariable UUID orderId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody SelfOrderDtos.ConfirmPaymentRequest body) {
        return selfOrderService.confirmPayment(hotelId, hotelHeader, orderId, body);
    }

    @PatchMapping("/{orderId}/status")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public SelfOrderDtos.StaffOrderRow patchStatus(
            @PathVariable UUID hotelId,
            @PathVariable UUID orderId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody SelfOrderDtos.PatchOrderStatusRequest body) {
        return selfOrderService.patchStatus(hotelId, hotelHeader, orderId, body);
    }
}
