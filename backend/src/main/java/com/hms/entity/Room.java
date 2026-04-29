package com.hms.entity;

import com.hms.domain.CleanlinessStatus;
import com.hms.domain.RoomStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(
        name = "rooms",
        uniqueConstraints =
                @UniqueConstraint(name = "uk_room_hotel_number", columnNames = {"hotel_id", "room_number"}))
@SQLRestriction("deleted = false")
@Getter
@Setter
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_type_id", nullable = false)
    private RoomType roomType;

    /** Active in-house reservation occupying this room (Phase 1 check-in). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_booking_id")
    private Reservation currentBooking;

    @Column(name = "room_number", nullable = false, length = 32)
    private String roomNumber;

    @Column(name = "floor_num")
    private Integer floor;

    @Column(length = 128)
    private String building;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private RoomStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CleanlinessStatus cleanliness;

    @Column(name = "is_out_of_order", nullable = false)
    private boolean outOfOrder;

    @Column(name = "maintenance_notes", columnDefinition = "TEXT")
    private String maintenanceNotes;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "amenities_override", columnDefinition = "TEXT")
    private String amenitiesOverride;

    @Column(name = "has_minibar", nullable = false)
    @ColumnDefault("true")
    private boolean hasMinibar = true;

    /** Do-not-disturb: housekeeping routes should skip service entry when true (spec §2 DND). */
    @Column(name = "dnd", nullable = false)
    @ColumnDefault("false")
    private boolean dnd;

    /** Optional auto-clear time for DND; null means indefinite until cleared. */
    @Column(name = "dnd_until")
    private Instant dndUntil;

    /** When DND was last turned on; cleared when DND is off (Phase 1 Step 4). */
    @Column(name = "dnd_set_at")
    private Instant dndSetAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        deleted = false;
        if (!dnd) {
            dndUntil = null;
            dndSetAt = null;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
