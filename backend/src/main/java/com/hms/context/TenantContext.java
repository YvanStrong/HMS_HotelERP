package com.hms.context;

import java.util.UUID;

/**
 * Request-scoped tenant (hotel) id for optional schema routing and logging. Cleared by {@link com.hms.web.TenantContextInterceptor}.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    public static void setTenantId(UUID hotelId) {
        if (hotelId == null) {
            CURRENT.remove();
        } else {
            CURRENT.set(hotelId);
        }
    }

    public static UUID getTenantId() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
