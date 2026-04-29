package com.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hms.setup")
public class SetupProperties {

    /** Shared secret for POST /api/v1/setup/initialize (X-Setup-Token header). */
    private String token = "";
}
