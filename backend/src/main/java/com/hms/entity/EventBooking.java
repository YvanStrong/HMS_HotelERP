package com.hms.entity;

import com.hms.domain.EventBookingStatus;
import com.hms.domain.EventBookingType;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "event_booking",
        indexes = {
            @Index(name = "idx_event_booking_hotel_group", columnList = "hotel_id, group_booking_id"),
            @Index(name = "idx_event_booking_venue_window", columnList = "hotel_id, venue_or_facility_id, start_datetime, end_datetime")
        })
@Getter
@Setter
public class EventBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_booking_id", nullable = false)
    private GroupBooking groupBooking;

    @Column(name = "event_name", nullable = false, length = 200)
    private String eventName;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 32)
    private EventBookingType eventType = EventBookingType.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EventBookingStatus status = EventBookingStatus.TENTATIVE;

    @Column(name = "start_datetime", nullable = false)
    private LocalDateTime startDatetime;

    @Column(name = "end_datetime", nullable = false)
    private LocalDateTime endDatetime;

    @Column(name = "setup_style", length = 80)
    private String setupStyle;

    @Column(name = "expected_pax")
    private Integer expectedPax;

    @Column(name = "guaranteed_pax")
    private Integer guaranteedPax;

    @Column(name = "venue_or_facility_id")
    private UUID venueOrFacilityId;

    @Column(name = "coordinator_notes", columnDefinition = "TEXT")
    private String coordinatorNotes;

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
