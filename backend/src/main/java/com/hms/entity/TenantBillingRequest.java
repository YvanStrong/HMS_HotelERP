package com.hms.entity;

import com.hms.domain.SubscriptionTier;
import com.hms.domain.TenantBillingRequestStatus;
import com.hms.domain.TenantBillingRequestType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tenant_billing_requests")
@Getter
@Setter
public class TenantBillingRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hotel_id", nullable = false)
    private UUID hotelId;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 20)
    private TenantBillingRequestType requestType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_tier", length = 20)
    private SubscriptionTier targetTier;

    private Integer months;

    @Column(name = "quoted_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal quotedAmount = BigDecimal.ZERO;

    @Column(length = 8)
    private String currency;

    @Column(name = "payment_reference", length = 120)
    private String paymentReference;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TenantBillingRequestStatus status = TenantBillingRequestStatus.PENDING;

    @Column(name = "requested_by")
    private UUID requestedBy;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt = Instant.now();

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolve_note", columnDefinition = "TEXT")
    private String resolveNote;
}
