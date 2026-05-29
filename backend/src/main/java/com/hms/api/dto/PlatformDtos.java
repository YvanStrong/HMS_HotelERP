package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

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
            @NotNull UUID hotelId,
            String email,
            String role) {}

    public record TenantSubscriptionStatusResponse(
            UUID hotelId,
            String hotelName,
            String billingStatus,
            LocalDate subscriptionStartDate,
            LocalDate subscriptionEndDate,
            Long daysRemaining,
            boolean suspended,
            boolean manuallyBlocked,
            String manualBlockReason,
            Instant blockedAt,
            UUID blockedBy,
            Instant lastPaymentConfirmedAt,
            BigDecimal monthlyPrice,
            String currency) {}

    public record RenewTenantSubscriptionRequest(
            @NotNull Integer months,
            BigDecimal amount,
            String currency,
            String paymentReference,
            String note) {}

    public record ManualBlockTenantRequest(@NotBlank String reason) {}

    public record ManualUnblockTenantRequest(String note) {}

    public record UpdateTenantSubscriptionSettingsRequest(
            BigDecimal monthlyPrice,
            LocalDate subscriptionEndDate,
            String note) {}

    public record PlatformModuleRow(
            UUID id,
            String moduleKey,
            String label,
            String description,
            String navSection,
            String tier,
            boolean locked,
            boolean paidAddon,
            BigDecimal pricePerMonth,
            boolean active,
            Integer sortOrder,
            Boolean enabled,
            Boolean showWhenDisabled,
            String billingStatus) {}

    public record UpdatePlatformModuleRequest(
            String label,
            String description,
            String tier,
            BigDecimal pricePerMonth,
            Boolean clearPrice,
            Boolean active,
            Integer sortOrder) {}

    public record BusinessCategoryRow(
            UUID id,
            String code,
            String name,
            String description,
            String icon,
            boolean active,
            List<PlatformModuleRow> modules) {}

    public record UpsertBusinessCategoryRequest(
            @NotBlank String code,
            @NotBlank String name,
            String description,
            String icon,
            List<String> moduleKeys) {}

    public record HotelModuleEntitlementsResponse(
            List<PlatformModuleRow> coreModules,
            List<PlatformModuleRow> enabledModules,
            List<PlatformModuleRow> disabledModules,
            List<PlatformModuleRow> availableAddons,
            List<String> enabledModuleKeys) {}

    public record ApplyCategoryRequest(@NotNull UUID categoryId) {}

    public record UpdateModuleEntitlementRequest(
            Boolean enabled, Boolean showWhenDisabled, String billingStatus, String reason) {}

    public record ActivateAddonRequest(String billingStatus) {}

    public record UpdateModuleEntitlementResponse(HotelModuleEntitlementsResponse entitlements, List<String> cascadeDisabled) {}

    public record ModuleEntitlementsContextResponse(List<String> enabledModules, List<String> visibleDisabledModules) {}

    public record HotelModuleAuditRow(
            UUID id,
            UUID hotelId,
            String moduleKey,
            Boolean oldEnabled,
            Boolean newEnabled,
            String oldBilling,
            String newBilling,
            UUID changedBy,
            Instant changedAt,
            String reason) {}
}
