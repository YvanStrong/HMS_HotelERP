package com.hms.service;

import com.hms.domain.PlatformBillingStatus;
import java.time.LocalDate;

public record SubscriptionState(
        PlatformBillingStatus status,
        long daysRemaining,
        boolean blocked,
        String code,
        String reason,
        String message,
        LocalDate expiryDate) {}
