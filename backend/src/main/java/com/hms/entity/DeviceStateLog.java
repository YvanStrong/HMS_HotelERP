package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Log of device state changes for audit and analytics. */
@Entity
@Table(name = "device_state_log")
@Getter
@Setter
public class DeviceStateLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_id", nullable = false)
    private RoomDevice device;

    /** JSON: {"temperature":22,"mode":"cool"} */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String state;

    /** GUEST, STAFF, AUTOMATION, SENSOR */
    @Column(nullable = false, length = 20)
    private String source;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @PrePersist
    void prePersist() {
        recordedAt = Instant.now();
    }
}
