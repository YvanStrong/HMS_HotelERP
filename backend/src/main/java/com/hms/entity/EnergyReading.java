package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Energy / utility meter reading for sustainability tracking. */
@Entity
@Table(name = "energy_readings")
@Getter
@Setter
public class EnergyReading {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    /** ELECTRICITY, WATER, GAS */
    @Column(name = "reading_type", nullable = false, length = 20)
    private String readingType;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal value;

    /** kWh, liters, m3 */
    @Column(nullable = false, length = 10)
    private String unit;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @PrePersist
    void prePersist() {
        recordedAt = Instant.now();
    }
}
