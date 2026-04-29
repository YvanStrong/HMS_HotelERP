package com.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hms.jwt")
public class JwtProperties {

    private String secret;
    private long expirationMs = 86400000L;
    /** Refresh token lifetime (ms); default 7 days. */
    private long refreshExpirationMs = 604800000L;
}
