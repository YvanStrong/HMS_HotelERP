package com.hms.entity;

import com.hms.domain.FacilitySlotStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "facility_slots",
        uniqueConstraints = @UniqueConstraint(name = "uk_slot_facility_start", columnNames = {"facility_id", "start_time"}))
@Getter
@Setter
public class FacilitySlot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(name = "current_bookings", nullable = false)
    private int currentBookings = 0;

    @Column(name = "max_bookings", nullable = false)
    private int maxBookings = 10;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FacilitySlotStatus status = FacilitySlotStatus.AVAILABLE;

    @OneToMany(mappedBy = "slot", cascade = CascadeType.ALL)
    private List<FacilityBooking> bookings = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
