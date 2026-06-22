package com.hms.entity;

import com.hms.domain.EventCateringPackageType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "event_catering_package")
@Getter
@Setter
public class EventCateringPackage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "package_name", nullable = false, length = 200)
    private String packageName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "package_type", nullable = false, length = 32)
    private EventCateringPackageType packageType = EventCateringPackageType.CUSTOM;

    @Column(name = "price_per_pax", nullable = false, precision = 14, scale = 2)
    private BigDecimal pricePerPax = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean taxable = true;

    @Column(nullable = false)
    private boolean active = true;

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
