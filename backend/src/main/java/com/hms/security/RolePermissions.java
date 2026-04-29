package com.hms.security;

import com.hms.domain.Role;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** v2.3-style coarse permissions derived from {@link Role} for login payload. */
public final class RolePermissions {

    private static final Map<Role, List<String>> BY_ROLE = new EnumMap<>(Role.class);

    static {
        put(Role.SUPER_ADMIN, "platform:*", "tenant:*");
        put(Role.HOTEL_ADMIN, "hotel:*", "room:*", "reservation:*", "guest:*", "billing:*", "report:*");
        put(Role.MANAGER, "hotel:read", "room:*", "reservation:*", "guest:*", "billing:read", "report:*");
        put(Role.RECEPTIONIST, "hotel:read", "room:read", "reservation:*", "guest:read", "folio:*");
        put(Role.HOUSEKEEPING, "hotel:read", "room:read", "room:status", "housekeeping:*");
        put(Role.HOUSEKEEPING_SUPERVISOR, "hotel:read", "room:*", "housekeeping:*");
        put(Role.MAINTENANCE, "hotel:read", "room:read", "room:maintenance");
        put(Role.FNB_STAFF, "hotel:read", "room:read", "fb:*", "folio:charge");
        put(Role.FINANCE, "hotel:read", "billing:*", "report:*", "folio:read");
        put(Role.GUEST, "guest:self", "reservation:self");
        put(Role.CORPORATE_BOOKER, "guest:self", "reservation:*");
    }

    private RolePermissions() {}

    private static void put(Role role, String... perms) {
        BY_ROLE.put(role, List.of(perms));
    }

    public static List<String> forRole(Role role) {
        return new ArrayList<>(BY_ROLE.getOrDefault(role, List.of()));
    }
}
