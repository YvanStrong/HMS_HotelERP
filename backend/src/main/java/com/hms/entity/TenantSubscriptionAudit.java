package com.hms.entity;

import com.hms.domain.PlatformBillingStatus;
import com.hms.domain.TenantSubscriptionAuditAction;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tenant_subscription_audit")
@Getter
@Setter
public class TenantSubscriptionAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hotel_id", nullable = false)
    private UUID hotelId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 64)
    private TenantSubscriptionAuditAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 32)
    private PlatformBillingStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", length = 32)
    private PlatformBillingStatus newStatus;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "old_expiry")
    private Instant oldExpiry;

    @Column(name = "new_expiry")
    private Instant newExpiry;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
