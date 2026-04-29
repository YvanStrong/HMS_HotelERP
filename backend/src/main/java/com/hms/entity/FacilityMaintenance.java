package com.hms.entity;

import com.hms.domain.FacilityMaintenanceStatus;
import com.hms.domain.FacilityPriority;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "facility_maintenances")
@Getter
@Setter
public class FacilityMaintenance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "reported_by", length = 128)
    private String reportedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FacilityPriority priority = FacilityPriority.MEDIUM;

    @Column(name = "reported_at", nullable = false)
    private Instant reportedAt;

    @Column(name = "scheduled_start")
    private Instant scheduledStart;

    @Column(name = "scheduled_end")
    private Instant scheduledEnd;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FacilityMaintenanceStatus status = FacilityMaintenanceStatus.REPORTED;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "affected_slot_ids", columnDefinition = "jsonb")
    private List<UUID> affectedSlotIds = new ArrayList<>();

    @Column(precision = 14, scale = 2)
    private BigDecimal cost;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (reportedAt == null) {
            reportedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
