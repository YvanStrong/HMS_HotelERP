package com.hms.service;

import com.hms.domain.PlatformBillingStatus;
import com.hms.entity.PlatformTenant;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;

@Service
public class SubscriptionStateResolver {

    public static final int EXPIRING_SOON_DAYS = 15;

    private final Clock clock;

    public SubscriptionStateResolver(Clock clock) {
        this.clock = clock;
    }

    public SubscriptionState resolve(PlatformTenant tenant) {
        if (tenant == null) {
            return blocked(
                    PlatformBillingStatus.EXPIRED,
                    "TENANT_NOT_CONFIGURED",
                    "CONFIGURATION_MISSING",
                    "Hotel subscription is not configured.",
                    null,
                    Long.MAX_VALUE);
        }
        LocalDate today = LocalDate.now(clock);
        LocalDate expiryDate = tenant.getSubscriptionEnd() != null
                ? LocalDate.ofInstant(tenant.getSubscriptionEnd(), ZoneOffset.UTC)
                : null;
        if (expiryDate == null) {
            return blocked(
                    PlatformBillingStatus.EXPIRED,
                    "TENANT_SUBSCRIPTION_NOT_CONFIGURED",
                    "CONFIGURATION_MISSING",
                    "Hotel subscription expiry is not configured.",
                    null,
                    Long.MAX_VALUE);
        }
        long daysRemaining = expiryDate != null ? ChronoUnit.DAYS.between(today, expiryDate) : Long.MAX_VALUE;
        if (tenant.isManuallyBlocked() || tenant.getBillingStatus() == PlatformBillingStatus.MANUALLY_BLOCKED) {
            return blocked(
                    PlatformBillingStatus.MANUALLY_BLOCKED,
                    "MANUALLY_BLOCKED",
                    "MANUAL_BLOCK",
                    "Hotel blocked by platform.",
                    expiryDate,
                    daysRemaining);
        }
        if (expiryDate != null && expiryDate.isBefore(today)) {
            return blocked(
                    PlatformBillingStatus.EXPIRED,
                    "SUBSCRIPTION_EXPIRED",
                    "AUTO_EXPIRY",
                    "Hotel subscription expired.",
                    expiryDate,
                    daysRemaining);
        }
        if (tenant.getBillingStatus() != PlatformBillingStatus.ACTIVE
                && tenant.getBillingStatus() != PlatformBillingStatus.EXPIRING_SOON) {
            return blocked(
                    tenant.getBillingStatus(),
                    "SUBSCRIPTION_" + tenant.getBillingStatus().name(),
                    tenant.getBillingStatus().name(),
                    "Hotel subscription is not active.",
                    expiryDate,
                    daysRemaining);
        }
        PlatformBillingStatus status = daysRemaining <= EXPIRING_SOON_DAYS
                ? PlatformBillingStatus.EXPIRING_SOON
                : PlatformBillingStatus.ACTIVE;
        return new SubscriptionState(status, daysRemaining, false, "SUBSCRIPTION_ACTIVE", "ACTIVE", "Subscription active.", expiryDate);
    }

    private static SubscriptionState blocked(
            PlatformBillingStatus status,
            String code,
            String reason,
            String message,
            LocalDate expiryDate,
            long daysRemaining) {
        return new SubscriptionState(status, daysRemaining, true, code, reason, message, expiryDate);
    }
}
