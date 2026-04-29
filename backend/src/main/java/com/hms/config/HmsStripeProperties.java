package com.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hms.stripe")
public class HmsStripeProperties {

    /** Stripe secret API key (sk_...). Empty disables Stripe calls. */
    private String secretKey = "";

    /** Webhook signing secret (whsec_...). Empty disables signature verification (webhook returns 503). */
    private String webhookSecret = "";
}
