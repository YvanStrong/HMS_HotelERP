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
        name = "daily_revenue_snapshots",
        uniqueConstraints =
                @UniqueConstraint(name = "uk_daily_rev_hotel_date", columnNames = {"hotel_id", "summary_date"}))
@Getter
@Setter
public class DailyRevenueSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "summary_date", nullable = false)
    private LocalDate summaryDate;

    @Column(name = "invoice_total", nullable = false, precision = 14, scale = 2)
    private BigDecimal invoiceTotal = BigDecimal.ZERO;

    @Column(name = "invoice_count", nullable = false)
    private int invoiceCount;

    @Column(name = "aggregated_at", nullable = false)
    private Instant aggregatedAt;
}
