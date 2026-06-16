package com.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hms.jwt")
public class JwtProperties {

    private String secret;
    /** Legacy fallback when client-specific expiry is unset. */
    private long expirationMs = 86400000L;
    /** Mobile POS access token (default 15 min). */
    private long accessTokenExpiryMs = 900000L;
    /** HMS web access token (default 1 hour). */
    private long webAccessTokenExpiryMs = 3600000L;
    /** Refresh token lifetime (default 7 days). */
    private long refreshExpirationMs = 604800000L;
    /** Alias for refreshExpirationMs (backward compatibility). */
    private long refreshTokenExpiryMs = 604800000L;

    public long getRefreshExpirationMs() {
        return refreshTokenExpiryMs > 0 ? refreshTokenExpiryMs : refreshExpirationMs;
    }
}
