package com.hms.security;

import com.hms.domain.Role;
import com.hms.web.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class TenantAccessService {

    public UserPrincipal currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required");
        }
        return principal;
    }

    /**
     * Enforces X-Hotel-ID header matches path hotelId and user is scoped to that hotel (unless SUPER_ADMIN).
     */
    public void assertHotelAccess(UUID hotelIdFromPath, String hotelIdHeader) {
        UserPrincipal user = currentUser();
        if (user.getRole() == Role.SUPER_ADMIN) {
            return;
        }
        if (hotelIdHeader == null || hotelIdHeader.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "X_HOTEL_ID_REQUIRED", "X-Hotel-ID header is required");
        }
        String headerRaw = sanitizeHeaderUuid(hotelIdHeader);
        if (headerRaw.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "X_HOTEL_ID_REQUIRED", "X-Hotel-ID header is required");
        }
        UUID headerId;
        try {
            headerId = UUID.fromString(headerRaw);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_X_HOTEL_ID", "Invalid X-Hotel-ID");
        }
        if (!headerId.equals(hotelIdFromPath)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "X_HOTEL_ID_MISMATCH", "X-Hotel-ID must match hotel in URL");
        }
        if (user.getHotelId() == null || !user.getHotelId().equals(hotelIdFromPath)) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "TENANT_MISMATCH",
                    "User is not assigned to this hotel");
        }
    }

    public void assertRoleAny(Role... allowed) {
        UserPrincipal user = currentUser();
        for (Role r : allowed) {
            if (user.getRole() == r) {
                return;
            }
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "INSUFFICIENT_ROLE", "Insufficient role");
    }

    /** Strip line breaks / invisible chars often pasted into Postman env vars (Node rejects those in headers). */
    private static String sanitizeHeaderUuid(String s) {
        if (s == null) {
            return "";
        }
        return s.trim()
                .replace("\r", "")
                .replace("\n", "")
                .replace("\u2028", "")
                .replace("\u2029", "")
                .trim();
    }
}
