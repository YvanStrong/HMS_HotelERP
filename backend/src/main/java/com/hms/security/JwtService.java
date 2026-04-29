package com.hms.security;

import com.hms.config.JwtProperties;
import com.hms.domain.Role;
import com.hms.web.ApiException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final JwtProperties props;

    public JwtService(JwtProperties props) {
        this.props = props;
    }

    private SecretKey key() {
        return Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(UserPrincipal user) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + props.getExpirationMs());
        var builder = Jwts.builder()
                .subject(user.getId().toString())
                .claim("username", user.getUsername())
                .claim("role", user.getRole().name())
                .issuedAt(now)
                .expiration(exp);
        if (user.getHotelId() != null) {
            builder.claim("hotelId", user.getHotelId().toString());
        }
        return builder.signWith(key()).compact();
    }

    /** Long-lived refresh token (v2.3); claim {@code typ=refresh}. */
    public String generateRefreshToken(UserPrincipal user) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + props.getRefreshExpirationMs());
        var builder = Jwts.builder()
                .subject(user.getId().toString())
                .claim("typ", "refresh")
                .claim("username", user.getUsername())
                .issuedAt(now)
                .expiration(exp);
        if (user.getHotelId() != null) {
            builder.claim("hotelId", user.getHotelId().toString());
        }
        return builder.signWith(key()).compact();
    }

    public UUID parseRefreshTokenUserId(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
            if (!"refresh".equals(claims.get("typ", String.class))) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "Not a refresh token");
            }
            return UUID.fromString(claims.getSubject());
        } catch (ExpiredJwtException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_EXPIRED", "Refresh token has expired");
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "Invalid refresh token");
        }
    }

    public boolean isImpersonationJwt(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
            return Boolean.TRUE.equals(claims.get("impersonation", Boolean.class));
        } catch (Exception e) {
            return false;
        }
    }

    public UserPrincipal parseToken(String token) {
        Claims claims = Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
        if ("refresh".equals(claims.get("typ", String.class))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN", "Use an access token, not a refresh token");
        }
        UUID id = UUID.fromString(claims.getSubject());
        String username = claims.get("username", String.class);
        Role role = Role.valueOf(claims.get("role", String.class));
        String hid = claims.get("hotelId", String.class);
        UUID hotelId = hid != null ? UUID.fromString(hid) : null;
        return UserPrincipal.authenticated(id, username, role, hotelId);
    }

    /**
     * Short-lived token: {@link Role#HOTEL_ADMIN} scoped to {@code hotelId} for support impersonation.
     * Caller must send normal Authorization Bearer (super admin) plus optional {@code X-Impersonate-Token} — or use
     * this token alone as Bearer when calling hotel APIs (principal is synthetic, not an app_users row).
     */
    public String generateImpersonationToken(
            UUID impersonationSessionId,
            UUID impersonatorUserId,
            UUID hotelId,
            int durationMinutes,
            List<String> restrictActions) {
        Date now = new Date();
        long ms = Math.min(Math.max(durationMinutes, 1) * 60_000L, 120 * 60_000L);
        Date exp = new Date(now.getTime() + ms);
        String blocked =
                restrictActions == null || restrictActions.isEmpty()
                        ? ""
                        : String.join(",", restrictActions);
        return Jwts.builder()
                .subject(impersonationSessionId.toString())
                .claim("username", "impersonation")
                .claim("role", Role.HOTEL_ADMIN.name())
                .claim("hotelId", hotelId.toString())
                .claim("impersonation", true)
                .claim("impersonatorUserId", impersonatorUserId.toString())
                .claim("blockedActions", blocked)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key())
                .compact();
    }
}
