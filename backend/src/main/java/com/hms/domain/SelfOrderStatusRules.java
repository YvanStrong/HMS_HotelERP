package com.hms.domain;

/** Explicit self-order status transitions for staff / kitchen workflow. */
public final class SelfOrderStatusRules {

    private SelfOrderStatusRules() {}

    public static boolean isAllowedTransition(SelfOrderStatus from, SelfOrderStatus to) {
        if (from == to) {
            return true;
        }
        if (from == SelfOrderStatus.CANCELLED || from == SelfOrderStatus.COMPLETED) {
            return false;
        }
        if (to == SelfOrderStatus.CANCELLED) {
            return from == SelfOrderStatus.PLACED || from == SelfOrderStatus.IN_PROGRESS;
        }
        return switch (from) {
            case PLACED -> to == SelfOrderStatus.IN_PROGRESS;
            case IN_PROGRESS -> to == SelfOrderStatus.READY;
            case READY -> to == SelfOrderStatus.COMPLETED;
            default -> false;
        };
    }
}
