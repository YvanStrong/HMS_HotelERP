package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Log entry for every channel sync operation (push or pull). */
@Entity
@Table(name = "channel_sync_log")
@Getter
@Setter
public class ChannelSyncLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "connection_id", nullable = false)
    private ChannelConnection connection;

    /** PUSH or PULL */
    @Column(nullable = false, length = 10)
    private String direction;

    /** AVAILABILITY, RATE, RESERVATION */
    @Column(name = "payload_type", nullable = false, length = 30)
    private String payloadType;

    /** SUCCESS or FAILURE */
    @Column(nullable = false, length = 20)
    private String status;

    /** JSON: request/response summary */
    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
