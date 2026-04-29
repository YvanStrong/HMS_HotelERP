package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Per-night rate override for a room type (dynamic rate management slice of spec §2). */
@Entity
@Table(
        name = "room_type_nightly_rates",
        uniqueConstraints =
                @UniqueConstraint(name = "uk_room_type_rate_date", columnNames = {"room_type_id", "rate_date"}))
@Getter
@Setter
public class RoomTypeNightlyRate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_type_id", nullable = false)
    private RoomType roomType;

    @Column(name = "rate_date", nullable = false)
    private LocalDate rateDate;

    @Column(name = "nightly_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal nightlyRate;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
