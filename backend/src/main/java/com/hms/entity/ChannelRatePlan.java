package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Rate plan mapping between a channel connection and a room type. */
@Entity
@Table(name = "channel_rate_plans")
@Getter
@Setter
public class ChannelRatePlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "connection_id", nullable = false)
    private ChannelConnection connection;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_type_id", nullable = false)
    private RoomType roomType;

    @Column(name = "channel_room_code", length = 50)
    private String channelRoomCode;

    @Column(name = "rate_markup_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal rateMarkupPct = BigDecimal.ZERO;

    @Column(name = "min_stay", nullable = false)
    private int minStay = 1;

    /** JSON: closed_to_arrival, stop_sell, etc. */
    @Column(columnDefinition = "TEXT")
    private String restrictions;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
