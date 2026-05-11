package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Scheduled report delivery configuration. */
@Entity
@Table(name = "report_schedules")
@Getter
@Setter
public class ReportSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    /** OCCUPANCY, REVENUE, GUEST_ANALYTICS, INVENTORY, HOUSEKEEPING */
    @Column(name = "report_type", nullable = false, length = 30)
    private String reportType;

    /** DAILY, WEEKLY, MONTHLY */
    @Column(nullable = false, length = 20)
    private String frequency;

    /** Comma-separated email addresses. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String recipients;

    /** PDF or CSV */
    @Column(nullable = false, length = 10)
    private String format = "PDF";

    @Column(name = "last_sent_at")
    private Instant lastSentAt;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
