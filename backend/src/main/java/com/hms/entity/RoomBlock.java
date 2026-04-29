package com.hms.entity;

import com.hms.domain.RoomBlockType;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Blocks a physical room for a date range (checkout-exclusive end date, same convention as reservations).
 * Released blocks set {@link #releasedAt}.
 */
@Entity
@Table(name = "room_blocks")
@Getter
@Setter
public class RoomBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Enumerated(EnumType.STRING)
    @Column(name = "block_type", nullable = false, length = 32)
    private RoomBlockType blockType;

    /** First night blocked (inclusive). */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** First night NOT blocked (exclusive) — same as reservation check-out date semantics. */
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** When set, block is inactive and no longer restricts assignment. */
    @Column(name = "released_at")
    private Instant releasedAt;

    @Column(name = "auto_release", nullable = false)
    private boolean autoRelease;

    /** Wall-clock end for {@link #autoRelease}; optional legacy rows use date range only. */
    @Column(name = "blocked_until_instant")
    private Instant blockedUntilInstant;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
