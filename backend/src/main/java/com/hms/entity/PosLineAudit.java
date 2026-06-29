package com.hms.entity;

import com.hms.domain.PosLineAuditAction;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "pos_line_audit")
@Getter
@Setter
public class PosLineAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false)
    private PosTableTicket ticket;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "line_id", nullable = false)
    private PosTableTicketLine line;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PosLineAuditAction action;

    @Column(name = "original_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal originalPrice;

    @Column(name = "original_qty", nullable = false)
    private int originalQty;

    @Column(name = "discount_pct", precision = 5, scale = 2)
    private BigDecimal discountPct;

    @Column(name = "discount_amount", precision = 10, scale = 2)
    private BigDecimal discountAmount;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "authorized_by", nullable = false)
    private AppUser authorizedBy;

    @Column(name = "authorized_at", nullable = false)
    private Instant authorizedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private AppUser createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (authorizedAt == null) {
            authorizedAt = Instant.now();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
