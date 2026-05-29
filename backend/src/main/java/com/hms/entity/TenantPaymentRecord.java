package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tenant_payment_record")
@Getter
@Setter
public class TenantPaymentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hotel_id", nullable = false)
    private UUID hotelId;

    @Column(name = "months_paid", nullable = false)
    private int monthsPaid;

    @Column(precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(length = 8)
    private String currency;

    @Column(name = "payment_reference", length = 128)
    private String paymentReference;

    @Column(name = "confirmed_by")
    private UUID confirmedBy;

    @Column(name = "confirmed_at", nullable = false)
    private Instant confirmedAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
