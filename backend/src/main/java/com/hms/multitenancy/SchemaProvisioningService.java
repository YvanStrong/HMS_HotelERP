package com.hms.multitenancy;

import com.hms.config.HmsMultitenancyProperties;
import com.hms.repository.PlatformTenantRepository;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates optional per-tenant PostgreSQL schemas ({@code tenant_<uuidWithoutHyphens>}). JPA entities remain in
 * {@code public}; this prepares isolated schemas for future table migration or native tenant data.
 */
@Service
public class SchemaProvisioningService {

    private final JdbcTemplate jdbcTemplate;
    private final HmsMultitenancyProperties multitenancyProperties;
    private final PlatformTenantRepository platformTenantRepository;

    public SchemaProvisioningService(
            JdbcTemplate jdbcTemplate,
            HmsMultitenancyProperties multitenancyProperties,
            PlatformTenantRepository platformTenantRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.multitenancyProperties = multitenancyProperties;
        this.platformTenantRepository = platformTenantRepository;
    }

    public String schemaNameForTenant(UUID hotelId) {
        String suffix = hotelId.toString().replace("-", "");
        String pfx = multitenancyProperties.getSchemaPrefix().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "");
        if (pfx.isEmpty()) {
            pfx = "tenant";
        }
        return pfx + "_" + suffix;
    }

    @Transactional
    public void ensureTenantSchema(UUID hotelId) {
        if (!multitenancyProperties.isSchemaIsolationEnabled()) {
            return;
        }
        String schema = schemaNameForTenant(hotelId);
        if (!schema.matches("[a-z][a-z0-9_]*")) {
            throw new IllegalArgumentException("Invalid derived schema name: " + schema);
        }
        jdbcTemplate.execute("CREATE SCHEMA IF NOT EXISTS " + schema);
        platformTenantRepository
                .findById(hotelId)
                .ifPresent(t -> {
                    t.setDatabaseSchema(schema);
                    platformTenantRepository.save(t);
                });
    }
}
