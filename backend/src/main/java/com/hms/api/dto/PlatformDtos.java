package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class PlatformDtos {

    private PlatformDtos() {}

    public record HotelContactInput(@NotBlank @Email String adminEmail, String adminName, String phone) {}

    public record PlatformCreateHotelInput(
            @NotBlank String name,
            @NotBlank String code,
            String timezone,
            String currency,
            @NotNull @Valid HotelContactInput contact) {}

    public record SubscriptionCustomLimits(Integer maxRooms, Integer maxUsers, Integer maxReservationsPerMonth) {}

    public record PlatformSubscriptionInput(
            @NotBlank String tier,
            @NotBlank String billingCycle,
            String startDate,
            SubscriptionCustomLimits customLimits) {}

    public record PlatformProvisioningInput(Boolean createDatabase, Boolean seedDemoData, List<String> enableFeatures) {}

    public record PlatformBillingInput(String paymentMethod, String stripeCustomerId, String invoiceEmail) {}

    public record CreatePlatformTenantRequest(
            @NotNull @Valid PlatformCreateHotelInput hotel,
            @NotNull @Valid PlatformSubscriptionInput subscription,
            PlatformProvisioningInput provisioning,
            PlatformBillingInput billing) {}

    public record ImpersonateRequest(
            @NotBlank String reason,
            int duration,
            Boolean notifyTenant,
            List<String> restrictActions) {}

    public record ImpersonationResponse(
            String impersonationId,
            String tenantId,
            String impersonationToken,
            String expiresAt,
            Map<String, Object> restrictions,
            Map<String, Object> notification,
            Map<String, Object> usage,
            Map<String, Object> audit) {}

    public record CreatePlatformStaffUserRequest(
            @NotBlank String username,
            @NotBlank String password,
            @NotNull java.util.UUID hotelId,
            String email,
            String role) {}
}
