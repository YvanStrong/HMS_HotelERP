package com.hms.security;

/** Spring Security {@code @PreAuthorize} expression for hotel POS / mobile waiter staff. */
public final class PosStaffRoles {

    public static final String ANY =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE',"
                    + "'ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')";

    public static final String MANAGER =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')";

    public static final String HOTEL_ADMIN =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')";

    public static final String WAITER =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_FNB_STAFF','ROLE_WAITER')";

    public static final String SHIFT_STAFF =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FNB_STAFF','ROLE_WAITER')";

    private PosStaffRoles() {}
}
