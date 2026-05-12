package com.hms.domain;

/** How group/corporate folio charges are split between master and member reservations. */
public enum GroupBillingPreference {
    MASTER_PAYS_ALL,
    SPLIT_BILLING,
    GUEST_PAYS_INCIDENTALS;

    public static GroupBillingPreference parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim().toUpperCase();
        if ("MASTER_PAYS".equals(s)) {
            return MASTER_PAYS_ALL;
        }
        try {
            return GroupBillingPreference.valueOf(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
