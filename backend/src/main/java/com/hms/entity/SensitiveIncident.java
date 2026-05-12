package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Register for sensitive incidents (security, behavioral issues, VIP complaints).
 * Part of the VIP & Blacklist Management workflow.
 */
@Entity
@Table(name = "sensitive_incidents")
@Getter
@Setter
public class SensitiveIncident {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private Guest guest;

    @Column(name = "incident_type", nullable = false, length = 50)
    private String incidentType; // SECURITY, DAMAGE, VERBAL_ABUSE, VIP_COMPLAINT

    @Column(name = "severity", nullable = false, length = 20)
    private String severity = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "action_taken", columnDefinition = "TEXT")
    private String actionTaken;

    @Column(name = "reported_at", nullable = false)
    private Instant reportedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by")
    private AppUser reportedBy;

    @PrePersist
    void prePersist() {
        if (reportedAt == null) {
            reportedAt = Instant.now();
        }
    }
}
