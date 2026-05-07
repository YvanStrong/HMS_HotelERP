package com.hms.entity;

import com.hms.domain.SelfOrderPaymentStatus;
import com.hms.domain.SelfOrderServiceType;
import com.hms.domain.SelfOrderStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "self_service_orders",
        uniqueConstraints =
                @UniqueConstraint(name = "uk_self_order_hotel_display", columnNames = {"hotel_id", "display_code"}))
@Getter
@Setter
public class SelfServiceOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "depot_id", nullable = false)
    private InventoryDepot depot;

    @Column(name = "order_number", nullable = false, length = 48)
    private String orderNumber;

    /** Short code shown on the kitchen TV and guest phone (e.g. A7K2). */
    @Column(name = "display_code", nullable = false, length = 8)
    private String displayCode;

    /** Unguessable token for the guest tracking URL. */
    @Column(name = "track_token", nullable = false, unique = true)
    private UUID trackToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 24)
    private SelfOrderServiceType serviceType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private SelfOrderStatus status = SelfOrderStatus.PLACED;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 16)
    private SelfOrderPaymentStatus paymentStatus = SelfOrderPaymentStatus.PAID;

    @Column(name = "payment_method", length = 40)
    private String paymentMethod;

    @Column(name = "customer_note", length = 280)
    private String customerNote;

    /** First name / call-out label for counter and KDS (optional). */
    @Column(name = "pickup_display_name", length = 64)
    private String pickupDisplayName;

    /** Table, seat, or area label (optional; e.g. from QR ?table=). */
    @Column(name = "pickup_location", length = 48)
    private String pickupLocation;

    /** E.164-ish phone for SMS when order becomes READY (optional). */
    @Column(name = "sms_notify_phone", length = 24)
    private String smsNotifyPhone;

    @Column(name = "sms_consent_version", length = 16)
    private String smsConsentVersion;

    @Column(name = "sms_consent_at")
    private Instant smsConsentAt;

    @Column(name = "last_notify_at")
    private Instant lastNotifyAt;

    @Column(name = "last_notify_status", length = 32)
    private String lastNotifyStatus;

    @Column(name = "last_notify_detail", length = 512)
    private String lastNotifyDetail;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SelfServiceOrderLine> lines = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
