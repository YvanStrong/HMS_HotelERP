package com.hms.security;

import com.hms.domain.Role;

/** Shared HTTP/STOMP resolution: Bearer JWT plus optional {@code X-Impersonate-Token} for super-admin. */
public final class JwtWebAuthSupport {

    private JwtWebAuthSupport() {}

    /**
     * If {@code X-Impersonate-Token} is set but is not a valid impersonation JWT (e.g. unresolved Postman
     * {@code {{impersonationToken}}}), it is ignored so the Bearer session is not wiped — that bug caused 403 on
     * every request when the header was present with garbage.
     */
    public static UserPrincipal resolvePrincipal(JwtService jwtService, String bearerToken, String impersonateToken) {
        UserPrincipal principal = null;
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            String token = bearerToken.substring(7);
            try {
                principal = jwtService.parseToken(token);
            } catch (Exception e) {
                return null;
            }
        }
        if (impersonateToken == null || impersonateToken.isBlank()) {
            return principal;
        }
        String impRaw = impersonateToken.trim();
        if (!jwtService.isImpersonationJwt(impRaw)) {
            return principal;
        }
        try {
            if (principal != null && principal.getRole() == Role.SUPER_ADMIN) {
                return jwtService.parseToken(impRaw);
            }
            return principal;
        } catch (Exception e) {
            return principal;
        }
    }
}
