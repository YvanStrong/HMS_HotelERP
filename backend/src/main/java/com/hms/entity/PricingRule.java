package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Occupancy/season/event-based pricing rule for dynamic rate management. */
@Entity
@Table(name = "pricing_rules")
@Getter
@Setter
public class PricingRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(nullable = false, length = 100)
    private String name;

    /** OCCUPANCY_BRACKET, DAY_OF_WEEK, SEASON, EVENT */
    @Column(name = "rule_type", nullable = false, length = 30)
    private String ruleType;

    /** JSON conditions: {"min_occupancy":80,"max_occupancy":95} or {"days":["FRIDAY","SATURDAY"]} */
    @Column(columnDefinition = "TEXT")
    private String conditions;

    @Column(nullable = false, precision = 5, scale = 3)
    private BigDecimal multiplier = BigDecimal.ONE;

    @Column(nullable = false)
    private int priority;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
