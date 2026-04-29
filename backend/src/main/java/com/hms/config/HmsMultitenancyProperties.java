package com.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Optional per-tenant PostgreSQL schema isolation. When enabled, {@link com.hms.multitenancy.SchemaProvisioningService}
 * creates {@code tenant_<uuid>} schemas; application data remains in {@code public} until entities are migrated.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "hms.multitenancy")
public class HmsMultitenancyProperties {

    /** When true, provisioning creates {@code tenant_*} schemas and {@link com.hms.context.TenantContext} is populated for routing hooks. */
    private boolean schemaIsolationEnabled = false;

    /** SQL identifier prefix for tenant schemas (alphanumeric suffix appended from hotel UUID without hyphens). */
    private String schemaPrefix = "tenant";
}
