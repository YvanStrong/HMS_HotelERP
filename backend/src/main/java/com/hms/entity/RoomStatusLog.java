package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Immutable audit row for room status / cleanliness changes (spec §2 visibility + audit). */
@Entity
@Table(name = "room_status_logs")
@Getter
@Setter
public class RoomStatusLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hotel_id", nullable = false)
    private UUID hotelId;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "room_number", length = 32)
    private String roomNumber;

    @Column(name = "previous_status", length = 32)
    private String previousStatus;

    @Column(name = "new_status", length = 32)
    private String newStatus;

    @Column(name = "previous_cleanliness", length = 32)
    private String previousCleanliness;

    @Column(name = "new_cleanliness", length = 32)
    private String newCleanliness;

    @Column(name = "actor", length = 128)
    private String actor;

    @Column(name = "changed_by_user_id")
    private UUID changedByUserId;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
