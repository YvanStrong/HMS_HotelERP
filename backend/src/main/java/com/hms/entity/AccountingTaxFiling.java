package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "accounting_tax_filings")
@Getter
@Setter
public class AccountingTaxFiling {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "tax_type", nullable = false, length = 64)
    private String taxType;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "taxable_sales", nullable = false, precision = 14, scale = 2)
    private BigDecimal taxableSales = BigDecimal.ZERO;

    @Column(name = "tax_collected", nullable = false, precision = 14, scale = 2)
    private BigDecimal taxCollected = BigDecimal.ZERO;

    @Column(name = "tax_paid", nullable = false, precision = 14, scale = 2)
    private BigDecimal taxPaid = BigDecimal.ZERO;

    @Column(name = "tax_due", nullable = false, precision = 14, scale = 2)
    private BigDecimal taxDue = BigDecimal.ZERO;

    @Column(nullable = false, length = 32)
    private String status = "DRAFT";

    @Column(name = "filing_reference", length = 128)
    private String filingReference;

    @Column(name = "filed_at")
    private Instant filedAt;

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
