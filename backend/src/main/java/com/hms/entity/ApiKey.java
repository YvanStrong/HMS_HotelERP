package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** API key for machine-to-machine authentication (POS, IoT, channel manager). */
@Entity
@Table(name = "api_keys")
@Getter
@Setter
public class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "key_hash", nullable = false, length = 128)
    private String keyHash;

    @Column(nullable = false, length = 100)
    private String name;

    /** Comma-separated scopes: room:read,reservation:read */
    @Column(columnDefinition = "TEXT")
    private String scopes;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
