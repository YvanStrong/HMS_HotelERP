package com.hms.service;

import com.hms.domain.SubscriptionTier;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.Map;

/** Shared SaaS plan prices/limits and mid-cycle proration math. */
public final class SubscriptionPlanCatalog {

    public record PlanDefinition(
            SubscriptionTier tier,
            String label,
            BigDecimal monthlyPrice,
            int maxRooms,
            int maxUsers,
            int maxReservationsPerMonth) {}

    private static final Map<SubscriptionTier, PlanDefinition> PLANS = new EnumMap<>(SubscriptionTier.class);

    static {
        PLANS.put(
                SubscriptionTier.STARTER,
                new PlanDefinition(SubscriptionTier.STARTER, "Starter", new BigDecimal("150000.00"), 50, 10, 500));
        PLANS.put(
                SubscriptionTier.PROFESSIONAL,
                new PlanDefinition(
                        SubscriptionTier.PROFESSIONAL, "Professional", new BigDecimal("250000.00"), 150, 50, 5000));
        PLANS.put(
                SubscriptionTier.ENTERPRISE,
                new PlanDefinition(
                        SubscriptionTier.ENTERPRISE, "Enterprise", new BigDecimal("500000.00"), 9999, 500, 100000));
    }

    private SubscriptionPlanCatalog() {}

    public static PlanDefinition plan(SubscriptionTier tier) {
        PlanDefinition def = PLANS.get(tier);
        if (def == null) {
            throw new IllegalArgumentException("Unknown subscription tier: " + tier);
        }
        return def;
    }

    public static Map<SubscriptionTier, PlanDefinition> allPlans() {
        return Map.copyOf(PLANS);
    }

    public static BigDecimal renewAmount(BigDecimal monthlyPrice, int months) {
        BigDecimal price = monthlyPrice != null ? monthlyPrice : BigDecimal.ZERO;
        return price.multiply(BigDecimal.valueOf(months)).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Prorated upgrade charge for remaining days in the current period.
     * credit = oldMonthly * daysLeft / periodDays; charge = newMonthly * daysLeft / periodDays;
     * amountDue = max(0, charge - credit). Downgrades return zero due (apply at next renewal).
     */
    public static BigDecimal proratedUpgradeAmount(
            BigDecimal oldMonthly, BigDecimal newMonthly, LocalDate today, LocalDate expiry) {
        if (expiry == null || !expiry.isAfter(today)) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        long daysLeft = ChronoUnit.DAYS.between(today, expiry);
        if (daysLeft <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        LocalDate periodStart = expiry.minusMonths(1);
        long periodDays = Math.max(1, ChronoUnit.DAYS.between(periodStart, expiry));
        BigDecimal oldPrice = oldMonthly != null ? oldMonthly : BigDecimal.ZERO;
        BigDecimal newPrice = newMonthly != null ? newMonthly : BigDecimal.ZERO;
        if (newPrice.compareTo(oldPrice) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal credit = oldPrice
                .multiply(BigDecimal.valueOf(daysLeft))
                .divide(BigDecimal.valueOf(periodDays), 6, RoundingMode.HALF_UP);
        BigDecimal charge = newPrice
                .multiply(BigDecimal.valueOf(daysLeft))
                .divide(BigDecimal.valueOf(periodDays), 6, RoundingMode.HALF_UP);
        return charge.subtract(credit).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    public static int tierRank(SubscriptionTier tier) {
        return switch (tier) {
            case STARTER -> 1;
            case PROFESSIONAL -> 2;
            case ENTERPRISE -> 3;
        };
    }
}
