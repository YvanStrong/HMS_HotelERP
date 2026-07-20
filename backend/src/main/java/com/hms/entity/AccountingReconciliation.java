package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "accounting_reconciliations")
@Getter
@Setter
public class AccountingReconciliation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "bank_name", nullable = false, length = 160)
    private String bankName;

    @Column(name = "statement_start", nullable = false)
    private LocalDate statementStart;

    @Column(name = "statement_end", nullable = false)
    private LocalDate statementEnd;

    @Column(name = "statement_balance", nullable = false, precision = 14, scale = 2)
    private BigDecimal statementBalance = BigDecimal.ZERO;

    @Column(name = "system_balance", nullable = false, precision = 14, scale = 2)
    private BigDecimal systemBalance = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal difference = BigDecimal.ZERO;

    @Column(nullable = false, length = 32)
    private String status = "DRAFT";

    @Column(name = "reconciled_at")
    private Instant reconciledAt;

    @Column(name = "reconciled_by", length = 128)
    private String reconciledBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

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
