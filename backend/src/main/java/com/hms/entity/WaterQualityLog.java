package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "facility_water_quality_logs")
@Getter
@Setter
public class WaterQualityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "logged_at", nullable = false)
    private Instant loggedAt;

    @Column(name = "logged_by", nullable = false, length = 255)
    private String loggedBy;

    @Column(name = "ph_level", precision = 5, scale = 2)
    private BigDecimal phLevel;

    @Column(name = "free_chlorine_ppm", precision = 5, scale = 2)
    private BigDecimal freeChlorinePpm;

    @Column(name = "combined_chlorine_ppm", precision = 5, scale = 2)
    private BigDecimal combinedChlorinePpm;

    @Column(name = "temperature_celsius", precision = 5, scale = 2)
    private BigDecimal temperatureCelsius;

    @Column(name = "turbidity_ntu", precision = 7, scale = 3)
    private BigDecimal turbidityNtu;

    @Column(name = "total_dissolved_solids")
    private Integer totalDissolvedSolids;

    @Column(name = "alkalinity_ppm", precision = 7, scale = 2)
    private BigDecimal alkalinityPpm;

    @Column(name = "calcium_hardness_ppm", precision = 7, scale = 2)
    private BigDecimal calciumHardnessPpm;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "passed_inspection", nullable = false)
    private boolean passedInspection = true;

    @Column(name = "inspector_name", length = 255)
    private String inspectorName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        if (loggedAt == null) {
            loggedAt = now;
        }
    }
}
