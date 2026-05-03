package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "payments")
@Getter
@Setter
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @Column(name = "payment_type", nullable = false, length = 20)
    private String paymentType;

    @Column(name = "method", nullable = false, length = 30)
    private String method;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 8)
    private String currency;

    @Column(name = "reference", length = 200)
    private String reference;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "COMPLETED";

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processed_by")
    private AppUser processedBy;

    @Column(name = "is_deposit", nullable = false)
    private boolean deposit;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "void_reason", columnDefinition = "TEXT")
    private String voidReason;

    @Column(name = "voided_at")
    private Instant voidedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (processedAt == null) {
            processedAt = now;
        }
        createdAt = now;
    }
}
