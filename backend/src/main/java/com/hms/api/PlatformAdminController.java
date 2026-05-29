package com.hms.api;

import com.hms.api.dto.PlatformDtos;
import com.hms.service.PlatformStaffUserService;
import com.hms.service.PlatformTenantService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform")
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class PlatformAdminController {

    private final PlatformTenantService platformTenantService;
    private final PlatformStaffUserService platformStaffUserService;

    public PlatformAdminController(
            PlatformTenantService platformTenantService, PlatformStaffUserService platformStaffUserService) {
        this.platformTenantService = platformTenantService;
        this.platformStaffUserService = platformStaffUserService;
    }

    @GetMapping("/tenants")
    public Map<String, Object> listTenants(
            @RequestParam(value = "status", required = false) String billingStatus,
            @RequestParam(required = false) String tier,
            @RequestParam(required = false) String search) {
        return platformTenantService.listTenants(billingStatus, tier, search);
    }

    @PostMapping("/tenants")
    public ResponseEntity<Map<String, Object>> createTenant(
            @Valid @RequestBody PlatformDtos.CreatePlatformTenantRequest body, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(platformTenantService.onboardTenant(body, request));
    }

    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> createStaffUser(@Valid @RequestBody PlatformDtos.CreatePlatformStaffUserRequest body) {
        platformStaffUserService.createHotelScopedUser(
                body.hotelId(), body.username(), body.password(), body.email(), body.role());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("username", body.username(), "hotelId", body.hotelId().toString()));
    }

    @GetMapping("/tenants/{tenantId}/dashboard")
    public Map<String, Object> tenantDashboard(@PathVariable UUID tenantId) {
        return platformTenantService.tenantDashboard(tenantId);
    }

    @GetMapping("/tenants/{tenantId}/subscription")
    public PlatformDtos.TenantSubscriptionStatusResponse subscription(@PathVariable UUID tenantId) {
        return platformTenantService.subscriptionStatus(tenantId);
    }

    @PostMapping("/tenants/{tenantId}/subscription/renew")
    public PlatformDtos.TenantSubscriptionStatusResponse renewSubscription(
            @PathVariable UUID tenantId,
            @Valid @RequestBody PlatformDtos.RenewTenantSubscriptionRequest body) {
        return platformTenantService.renewSubscription(tenantId, body);
    }

    @PatchMapping("/tenants/{tenantId}/subscription/settings")
    public PlatformDtos.TenantSubscriptionStatusResponse updateSubscriptionSettings(
            @PathVariable UUID tenantId,
            @RequestBody PlatformDtos.UpdateTenantSubscriptionSettingsRequest body) {
        return platformTenantService.updateSubscriptionSettings(tenantId, body);
    }

    @PostMapping("/tenants/{tenantId}/subscription/block")
    public PlatformDtos.TenantSubscriptionStatusResponse blockSubscription(
            @PathVariable UUID tenantId,
            @Valid @RequestBody PlatformDtos.ManualBlockTenantRequest body) {
        return platformTenantService.manuallyBlock(tenantId, body);
    }

    @PostMapping("/tenants/{tenantId}/subscription/unblock")
    public PlatformDtos.TenantSubscriptionStatusResponse unblockSubscription(
            @PathVariable UUID tenantId,
            @RequestBody(required = false) PlatformDtos.ManualUnblockTenantRequest body) {
        return platformTenantService.manuallyUnblock(
                tenantId, body != null ? body : new PlatformDtos.ManualUnblockTenantRequest(null));
    }

    @PostMapping("/tenants/{tenantId}/impersonate")
    public PlatformDtos.ImpersonationResponse impersonate(
            @PathVariable UUID tenantId,
            @Valid @RequestBody PlatformDtos.ImpersonateRequest body,
            HttpServletRequest request) {
        return platformTenantService.impersonate(tenantId, body, request);
    }

    @GetMapping("/analytics/revenue")
    public Map<String, Object> revenue(
            @RequestParam(defaultValue = "monthly") String period,
            @RequestParam(defaultValue = "tier") String groupBy) {
        return platformTenantService.revenueAnalytics(period, groupBy);
    }

    @GetMapping("/analytics/subscriptions")
    public Map<String, Object> subscriptions() {
        return platformTenantService.subscriptionAnalytics();
    }

    @GetMapping("/audit/logs")
    public List<Map<String, Object>> auditLogs(@RequestParam(required = false) UUID tenantId) {
        return platformTenantService.auditLogs(tenantId);
    }
}
