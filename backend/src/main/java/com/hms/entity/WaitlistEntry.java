package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "waitlist_entries")
@Getter
@Setter
public class WaitlistEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private Guest guest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_booking_id")
    private GroupBooking groupBooking;

    @Column(name = "requested_check_in", nullable = false)
    private LocalDate requestedCheckIn;

    @Column(name = "requested_check_out", nullable = false)
    private LocalDate requestedCheckOut;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    @Column(nullable = false)
    private Integer adults = 1;

    @Column(nullable = false)
    private Integer children = 0;

    @Column(name = "child_ages_json", columnDefinition = "TEXT")
    private String childAgesJson;

    @Column(name = "flexible_dates", nullable = false)
    private boolean flexibleDates;

    @Column(name = "source_code", length = 64)
    private String sourceCode;

    @Column(name = "market_code", length = 64)
    private String marketCode;

    @Column(nullable = false, length = 32)
    private String priority = "NORMAL";

    @Column(nullable = false, length = 32)
    private String status = "OPEN";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "converted_reservation_id")
    private Reservation convertedReservation;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "converted_at")
    private Instant convertedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
