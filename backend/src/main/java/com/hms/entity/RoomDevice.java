package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** IoT device registered to a hotel room. */
@Entity
@Table(name = "room_devices")
@Getter
@Setter
public class RoomDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    /** THERMOSTAT, LOCK, LIGHT, CURTAIN, TV, MINIBAR_SENSOR, MOTION */
    @Column(name = "device_type", nullable = false, length = 30)
    private String deviceType;

    @Column(name = "device_name", nullable = false, length = 100)
    private String deviceName;

    /** MQTT, REST, ZIGBEE, ZWAVE, MOCK */
    @Column(nullable = false, length = 20)
    private String protocol = "REST";

    @Column(length = 255)
    private String endpoint;

    /** Encrypted JSON: credentials for device */
    @Column(name = "auth_config", columnDefinition = "TEXT")
    private String authConfig;

    /** ONLINE, OFFLINE, ERROR */
    @Column(nullable = false, length = 20)
    private String status = "OFFLINE";

    @Column(name = "last_heartbeat")
    private Instant lastHeartbeat;

    /** JSON: model, firmware, capabilities */
    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
