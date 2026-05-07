package com.hms.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SelfOrderStateMachineTest {

    @Test
    void unpaidCannotEnterKitchen() {
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.PLACED, SelfOrderStatus.IN_PROGRESS))
                .isTrue();
    }

    @Test
    void placedToReadyBlocked() {
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.PLACED, SelfOrderStatus.READY))
                .isFalse();
    }

    @Test
    void kitchenProgression() {
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.IN_PROGRESS, SelfOrderStatus.READY))
                .isTrue();
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.READY, SelfOrderStatus.COMPLETED))
                .isTrue();
    }

    @Test
    void terminalStatesLocked() {
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.COMPLETED, SelfOrderStatus.READY))
                .isFalse();
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.CANCELLED, SelfOrderStatus.PLACED))
                .isFalse();
    }

    @Test
    void cancelFromPlacedOrInProgressOnly() {
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.PLACED, SelfOrderStatus.CANCELLED))
                .isTrue();
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.IN_PROGRESS, SelfOrderStatus.CANCELLED))
                .isTrue();
        assertThat(SelfOrderStatusRules.isAllowedTransition(SelfOrderStatus.READY, SelfOrderStatus.CANCELLED))
                .isFalse();
    }
}
