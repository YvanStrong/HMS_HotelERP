package com.hms.config;

import java.util.UUID;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "hms")
public class HmsPublicUrlProperties {

    /**
     * Public origin used in stored invoice PDF links (no trailing slash). Override in prod, e.g.
     * {@code https://api.yourdomain.com}.
     */
    private String publicBaseUrl = "http://localhost:8080";

    public String getPublicBaseUrl() {
        return publicBaseUrl;
    }

    public void setPublicBaseUrl(String publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl == null ? "http://localhost:8080" : publicBaseUrl.trim();
    }

    /** Base URL without trailing slash. */
    public String normalizedBaseUrl() {
        String s = getPublicBaseUrl();
        while (s.endsWith("/")) {
            s = s.substring(0, s.length() - 1);
        }
        return s.isEmpty() ? "http://localhost:8080" : s;
    }

    public String invoicePdfUrl(UUID hotelId, UUID invoiceId) {
        return normalizedBaseUrl() + "/api/v1/hotels/" + hotelId + "/invoices/" + invoiceId + "/pdf";
    }
}
