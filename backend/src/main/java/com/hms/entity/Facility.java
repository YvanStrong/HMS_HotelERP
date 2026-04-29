package com.hms.entity;

import com.hms.domain.FacilityType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "facilities",
        uniqueConstraints = @UniqueConstraint(name = "uk_facility_hotel_code", columnNames = {"hotel_id", "code"}))
@Getter
@Setter
public class Facility {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FacilityType type;

    @Column(name = "max_capacity")
    private Integer maxCapacity;

    @Column(name = "slot_duration_minutes")
    private Integer slotDurationMinutes = 60;

    @Column(name = "buffer_minutes_between_slots")
    private Integer bufferMinutesBetweenSlots = 0;

    @Column(name = "base_price", precision = 14, scale = 2)
    private BigDecimal basePrice = BigDecimal.ZERO;

    @Column(name = "requires_advance_booking", nullable = false)
    private boolean requiresAdvanceBooking = true;

    @Column(name = "allows_walk_in", nullable = false)
    private boolean allowsWalkIn = true;

    @ElementCollection
    @CollectionTable(name = "facility_amenities", joinColumns = @JoinColumn(name = "facility_id"))
    @Column(name = "amenity", length = 128)
    private List<String> amenities = new ArrayList<>();

    @OneToMany(mappedBy = "facility", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FacilityOperatingHour> operatingHours = new ArrayList<>();

    @OneToMany(mappedBy = "facility", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FacilitySlot> slots = new ArrayList<>();

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
