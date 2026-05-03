package com.hms.domain;

/** Kitchen / service lifecycle for self-service orders. */
public enum SelfOrderStatus {
    PLACED,
    IN_PROGRESS,
    READY,
    COMPLETED,
    CANCELLED
}
