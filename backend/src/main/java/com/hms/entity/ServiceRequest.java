package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Guest in-stay service request (extra towels, room service, maintenance, etc.). */
@Entity
@Table(name = "service_requests")
@Getter
@Setter
public class ServiceRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id")
    private Reservation reservation;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private Guest guest;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @Column(name = "room_number", length = 20)
    private String roomNumber;

    @Column(name = "booking_code", length = 50)
    private String bookingCode;

    /** HOUSEKEEPING, MAINTENANCE, FRONT_DESK, FB, SECURITY */
    @Column(name = "target_department", length = 30)
    private String targetDepartment;

    /** EXTRA_TOWELS, ROOM_SERVICE, MAINTENANCE, WAKE_UP, LATE_CHECKOUT, OTHER */
    @Column(name = "request_type", nullable = false, length = 30)
    private String requestType;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private AppUser assignedTo;

    /** LOW, NORMAL, HIGH, URGENT */
    @Column(nullable = false, length = 10)
    private String priority = "NORMAL";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

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
