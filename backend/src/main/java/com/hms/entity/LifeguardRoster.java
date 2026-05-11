package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "facility_lifeguard_roster")
@Getter
@Setter
public class LifeguardRoster {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "staff_name", nullable = false, length = 255)
    private String staffName;

    @Column(name = "staff_email", length = 255)
    private String staffEmail;

    @Column(name = "certification_name", length = 255)
    private String certificationName;

    @Column(name = "certification_expiry")
    private LocalDate certificationExpiry;

    @Column(name = "shift_date", nullable = false)
    private LocalDate shiftDate;

    @Column(name = "shift_start", nullable = false)
    private LocalTime shiftStart;

    @Column(name = "shift_end", nullable = false)
    private LocalTime shiftEnd;

    @Column(nullable = false, length = 64)
    private String status = "SCHEDULED";

    @Column(columnDefinition = "TEXT")
    private String notes;

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
