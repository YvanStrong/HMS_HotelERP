package com.hms.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Fails fast in {@code prod} when critical secrets are missing or unsafe defaults are still in use.
 */
@Component
@Profile("prod")
public class ProductionSecurityGuardrails implements ApplicationRunner {

    private static final int MIN_JWT_SECRET_BYTES = 32;

    private final JwtProperties jwtProperties;
    private final SetupProperties setupProperties;
    private final HmsPublicUrlProperties publicUrlProperties;
    private final FrontendUrlProperties frontendUrlProperties;

    public ProductionSecurityGuardrails(
            JwtProperties jwtProperties,
            SetupProperties setupProperties,
            HmsPublicUrlProperties publicUrlProperties,
            FrontendUrlProperties frontendUrlProperties) {
        this.jwtProperties = jwtProperties;
        this.setupProperties = setupProperties;
        this.publicUrlProperties = publicUrlProperties;
        this.frontendUrlProperties = frontendUrlProperties;
    }

    @Override
    public void run(ApplicationArguments args) {
        String secret = jwtProperties.getSecret();
        if (secret == null || secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < MIN_JWT_SECRET_BYTES) {
            throw new IllegalStateException("HMS_JWT_SECRET environment variable is required in production");
        }
        if (setupProperties.getToken() == null || setupProperties.getToken().isBlank()) {
            throw new IllegalStateException("HMS_SETUP_TOKEN environment variable is required in production");
        }
        if (publicUrlProperties.getPublicBaseUrl() == null || publicUrlProperties.getPublicBaseUrl().isBlank()) {
            throw new IllegalStateException("HMS_PUBLIC_BASE_URL environment variable is required in production");
        }
        if (frontendUrlProperties.getBaseUrl() == null || frontendUrlProperties.getBaseUrl().isBlank()) {
            throw new IllegalStateException("HMS_FRONTEND_BASE_URL environment variable is required in production");
        }
    }
}
