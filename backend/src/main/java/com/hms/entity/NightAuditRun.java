package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "night_audit_runs",
        uniqueConstraints = @UniqueConstraint(name = "uk_night_audit_hotel_date", columnNames = {"hotel_id", "run_date"}))
@Getter
@Setter
public class NightAuditRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "run_date", nullable = false)
    private LocalDate runDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "COMPLETED";

    @Column(name = "rooms_audited", nullable = false)
    private Integer roomsAudited = 0;

    @Column(name = "charges_posted", nullable = false)
    private Integer chargesPosted = 0;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "currency", length = 8)
    private String currency;

    @Column(name = "errors", columnDefinition = "TEXT")
    private String errors;

    @Column(name = "run_at", nullable = false)
    private Instant runAt;

    @Column(name = "run_by", nullable = false, length = 50)
    private String runBy = "SYSTEM";

    @PrePersist
    void prePersist() {
        if (runAt == null) {
            runAt = Instant.now();
        }
    }
}
