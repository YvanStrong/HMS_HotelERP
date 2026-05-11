package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** OTA / external channel connection for availability and rate sync. */
@Entity
@Table(name = "channel_connections")
@Getter
@Setter
public class ChannelConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    /** BOOKING_COM, EXPEDIA, AIRBNB, ICAL, GOOGLE */
    @Column(name = "channel_code", nullable = false, length = 30)
    private String channelCode;

    /** CONNECTED, DISCONNECTED, ERROR */
    @Column(nullable = false, length = 20)
    private String status = "DISCONNECTED";

    /** Encrypted JSON: API keys per channel */
    @Column(columnDefinition = "TEXT")
    private String credentials;

    /** JSON mapping: room_type_id → channel_room_id */
    @Column(columnDefinition = "TEXT")
    private String config;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "sync_errors", nullable = false)
    private int syncErrors;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
