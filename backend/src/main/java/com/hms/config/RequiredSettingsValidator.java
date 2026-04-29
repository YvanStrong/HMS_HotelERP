package com.hms.config;

import java.nio.charset.StandardCharsets;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Fails fast if JWT signing secret is missing or too short for HS256 (jjwt requires at least 256 bits).
 */
@Component
@Order(0)
public class RequiredSettingsValidator implements ApplicationRunner {

    private final JwtProperties jwtProperties;

    public RequiredSettingsValidator(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    @Override
    public void run(ApplicationArguments args) {
        String secret = jwtProperties.getSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT signing secret is not configured. Set environment variable JWT_SECRET or property hms.jwt.secret (minimum 32 UTF-8 bytes).");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "hms.jwt.secret must be at least 32 bytes when encoded as UTF-8 (required for HS256).");
        }
    }
}
