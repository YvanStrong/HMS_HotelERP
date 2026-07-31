package com.hms.domain;

public enum TenantSubscriptionAuditAction {
    AUTO_EXPIRED,
    MANUAL_BLOCK,
    MANUAL_UNBLOCK,
    RENEWAL,
    PLAN_CHANGE,
    BILLING_REQUEST,
    SETTINGS_UPDATE,
    LOGIN_REJECTED,
    TOKEN_REJECTED,
    API_ACCESS_REJECTED
}
