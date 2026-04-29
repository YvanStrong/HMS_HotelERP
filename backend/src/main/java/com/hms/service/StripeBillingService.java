package com.hms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.config.HmsStripeProperties;
import com.hms.domain.PlatformBillingStatus;
import com.hms.entity.PlatformTenant;
import com.hms.repository.PlatformTenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StripeBillingService {

    private static final Logger log = LoggerFactory.getLogger(StripeBillingService.class);

    private final HmsStripeProperties stripeProperties;
    private final PlatformTenantRepository platformTenantRepository;
    private final ObjectMapper objectMapper;
    private volatile StripeClient stripeClient;

    public StripeBillingService(
            HmsStripeProperties stripeProperties,
            PlatformTenantRepository platformTenantRepository,
            ObjectMapper objectMapper) {
        this.stripeProperties = stripeProperties;
        this.platformTenantRepository = platformTenantRepository;
        this.objectMapper = objectMapper;
    }

    private StripeClient clientOrNull() {
        String sk = stripeProperties.getSecretKey();
        if (sk == null || sk.isBlank()) {
            return null;
        }
        if (stripeClient == null) {
            synchronized (this) {
                if (stripeClient == null) {
                    stripeClient = new StripeClient(sk);
                }
            }
        }
        return stripeClient;
    }

    /**
     * Ensures a Stripe Customer exists for the tenant and stores {@code stripeCustomerId} on {@link PlatformTenant}.
     */
    @Transactional
    public void syncCustomerForTenant(UUID tenantId, String payloadJson) {
        StripeClient client = clientOrNull();
        if (client == null) {
            log.debug("Stripe secret key not configured; skipping STRIPE_CUSTOMER_SYNC for {}", tenantId);
            return;
        }
        PlatformTenant pt = platformTenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new IllegalStateException("Platform tenant missing: " + tenantId));
        String email = pt.getContactEmail();
        String name = pt.getHotelName();
        if (payloadJson != null && !payloadJson.isBlank()) {
            try {
                JsonNode n = objectMapper.readTree(payloadJson);
                if (n.hasNonNull("email")) {
                    email = n.get("email").asText(email);
                }
                if (n.hasNonNull("name")) {
                    name = n.get("name").asText(name);
                }
            } catch (Exception ignored) {
                // keep platform tenant fields
            }
        }
        try {
            if (pt.getStripeCustomerId() != null && !pt.getStripeCustomerId().isBlank()) {
                CustomerUpdateParams.Builder ub = CustomerUpdateParams.builder()
                        .putMetadata("hms_tenant_id", tenantId.toString());
                if (name != null && !name.isBlank()) {
                    ub.setName(name);
                }
                if (email != null && !email.isBlank()) {
                    ub.setEmail(email);
                }
                client.customers().update(pt.getStripeCustomerId(), ub.build());
                return;
            }
            CustomerCreateParams.Builder cb =
                    CustomerCreateParams.builder().putMetadata("hms_tenant_id", tenantId.toString());
            if (name != null && !name.isBlank()) {
                cb.setName(name);
            }
            if (email != null && !email.isBlank()) {
                cb.setEmail(email);
            }
            Customer c = client.customers().create(cb.build());
            pt.setStripeCustomerId(c.getId());
            platformTenantRepository.save(pt);
        } catch (Exception e) {
            throw new IllegalStateException("Stripe customer sync failed: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void applySubscriptionActive(UUID tenantId) {
        platformTenantRepository.findById(tenantId).ifPresent(t -> {
            t.setBillingStatus(PlatformBillingStatus.ACTIVE);
            platformTenantRepository.save(t);
        });
    }

    @Transactional
    public void applySubscriptionPastDue(UUID tenantId) {
        platformTenantRepository.findById(tenantId).ifPresent(t -> {
            t.setBillingStatus(PlatformBillingStatus.PAST_DUE);
            platformTenantRepository.save(t);
        });
    }

    /** Resolves {@code hms_tenant_id} metadata from subscription or invoice payload. */
    public UUID resolveTenantFromStripeEvent(Event event) throws StripeException {
        Object obj =
                event.getDataObjectDeserializer().getObject().orElse(null);
        if (obj instanceof Subscription sub) {
            return metadataTenantId(sub.getMetadata());
        }
        if (obj instanceof Invoice inv) {
            Subscription subObj = inv.getSubscriptionObject();
            if (subObj != null) {
                UUID u = metadataTenantId(subObj.getMetadata());
                if (u != null) {
                    return u;
                }
            }
            String subId = inv.getSubscription();
            StripeClient client = clientOrNull();
            if (subId != null && !subId.isBlank() && client != null) {
                Subscription sub = client.subscriptions().retrieve(subId);
                UUID u = metadataTenantId(sub.getMetadata());
                if (u != null) {
                    return u;
                }
            }
            if (inv.getCustomer() != null && !inv.getCustomer().isBlank() && client != null) {
                Customer cust = client.customers().retrieve(inv.getCustomer());
                UUID u = metadataTenantId(cust.getMetadata());
                if (u != null) {
                    return u;
                }
            }
            return metadataTenantId(inv.getMetadata());
        }
        return null;
    }

    public void processWebhookEvent(Event event) throws StripeException {
        String type = event.getType();
        UUID tenantId = resolveTenantFromStripeEvent(event);
        switch (type) {
            case "invoice.paid":
            case "customer.subscription.updated":
                if (tenantId != null) {
                    applySubscriptionActive(tenantId);
                }
                break;
            case "invoice.payment_failed":
            case "customer.subscription.deleted":
                if (tenantId != null) {
                    applySubscriptionPastDue(tenantId);
                }
                break;
            default:
                break;
        }
    }

    private static UUID metadataTenantId(Map<String, String> meta) {
        if (meta == null) {
            return null;
        }
        String raw = meta.get("hms_tenant_id");
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
