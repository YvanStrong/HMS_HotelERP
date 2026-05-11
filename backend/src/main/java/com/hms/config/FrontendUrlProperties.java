package com.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hms.frontend")
public class FrontendUrlProperties {

    private String baseUrl = "";
}

