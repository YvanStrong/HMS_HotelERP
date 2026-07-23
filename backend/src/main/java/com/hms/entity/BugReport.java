package com.hms.entity;

import com.hms.domain.BugReportSeverity;
import com.hms.domain.BugReportStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "bug_reports")
@Getter
@Setter
public class BugReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "reporter_user_id")
    private UUID reporterUserId;

    @Column(name = "hotel_id")
    private UUID hotelId;

    @Column(name = "reporter_username", length = 128)
    private String reporterUsername;

    @Column(name = "reporter_email", length = 255)
    private String reporterEmail;

    @Column(name = "reporter_role", length = 64)
    private String reporterRole;

    @Column(name = "page_url", length = 1024)
    private String pageUrl;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private BugReportSeverity severity = BugReportSeverity.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private BugReportStatus status = BugReportStatus.OPEN;

    @Column(name = "admin_notes", columnDefinition = "TEXT")
    private String adminNotes;

    @Column(name = "email_sent", nullable = false)
    private boolean emailSent;

    @Column(name = "email_error", length = 500)
    private String emailError;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

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
