package com.hms.security;

import com.hms.domain.Role;
import com.hms.entity.Room;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component("tenantCollectionSecurity")
public class TenantCollectionSecurityHelper {

    public boolean tenantRoom(Room room) {
        if (room == null || room.getHotel() == null) {
            return false;
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal p)) {
            return false;
        }
        if (p.getRole() == Role.SUPER_ADMIN) {
            return true;
        }
        return p.getHotelId() != null && p.getHotelId().equals(room.getHotel().getId());
    }
}
