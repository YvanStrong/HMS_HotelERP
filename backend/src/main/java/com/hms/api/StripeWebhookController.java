package com.hms.api;

import com.hms.config.HmsStripeProperties;
import com.hms.service.StripeBillingService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final HmsStripeProperties stripeProperties;
    private final StripeBillingService stripeBillingService;

    public StripeWebhookController(HmsStripeProperties stripeProperties, StripeBillingService stripeBillingService) {
        this.stripeProperties = stripeProperties;
        this.stripeBillingService = stripeBillingService;
    }

    @PostMapping("/api/v1/webhooks/stripe")
    public ResponseEntity<String> handle(
            @RequestBody String payload, @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {
        String whsec = stripeProperties.getWebhookSecret();
        if (whsec == null || whsec.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("webhook not configured");
        }
        if (sigHeader == null || sigHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("missing signature");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, whsec);
        } catch (SignatureVerificationException e) {
            log.warn("Stripe webhook signature verification failed");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("invalid signature");
        }
        try {
            stripeBillingService.processWebhookEvent(event);
        } catch (Exception e) {
            log.warn("Stripe webhook handler error for {}: {}", event.getType(), e.toString());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("handler error");
        }
        return ResponseEntity.ok("ok");
    }
}
