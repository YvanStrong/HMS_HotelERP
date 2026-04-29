package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "platform_usage_metrics",
        uniqueConstraints =
                @UniqueConstraint(name = "uk_usage_tenant_date", columnNames = {"tenant_id", "metric_date"}))
@Getter
@Setter
public class PlatformUsageMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;

    @Column(name = "active_rooms")
    private Integer activeRooms;

    @Column(name = "active_users")
    private Integer activeUsers;

    @Column(name = "reservations_created")
    private Integer reservationsCreated;

    @Column(name = "api_calls")
    private Long apiCalls;

    @Column(name = "storage_used_mb")
    private Long storageUsedMB;

    @Column(name = "bandwidth_used_gb")
    private Long bandwidthUsedGB;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public boolean exceedsReservationLimit(PlatformTenant tenant) {
        if (tenant.getMaxReservationsPerMonth() == null || reservationsCreated == null) {
            return false;
        }
        return reservationsCreated > tenant.getMaxReservationsPerMonth();
    }
}
