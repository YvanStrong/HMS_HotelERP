package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "accounting_bank_statement_lines")
@Getter
@Setter
public class AccountingBankStatementLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "book_date", nullable = false)
    private LocalDate bookDate;

    @Column(name = "value_date")
    private LocalDate valueDate;

    @Column(length = 120)
    private String reference;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String narration;

    @Column(name = "debit_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal debitAmount = BigDecimal.ZERO;

    @Column(name = "credit_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal creditAmount = BigDecimal.ZERO;

    @Column(name = "balance_amount", precision = 14, scale = 2)
    private BigDecimal balanceAmount;

    @Column(name = "source_bank", nullable = false, length = 80)
    private String sourceBank = "Bank of Kigali";

    @Column(name = "recorded_by", length = 160)
    private String recordedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (bookDate == null) bookDate = LocalDate.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}

