package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "company_obligations")
@Getter
@Setter
public class CompanyObligation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    /** CREDIT = someone owes the company. DEBT = the company owes someone. */
    @Column(nullable = false, length = 16)
    private String kind;

    @Column(name = "party_name", nullable = false, length = 160)
    private String partyName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false, length = 16)
    private String status = "OPEN";

    @Column(name = "reference_no", length = 120)
    private String referenceNo;

    @Column(name = "recorded_by", length = 160)
    private String recordedBy;

    @Column(name = "settled_at")
    private Instant settledAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
