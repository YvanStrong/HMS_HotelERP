package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "reservation_segments")
@Getter
@Setter
public class ReservationSegment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_type_to_charge_id")
    private RoomType roomTypeToCharge;

    @Column(name = "segment_start", nullable = false)
    private LocalDate segmentStart;

    @Column(name = "segment_end", nullable = false)
    private LocalDate segmentEnd;

    @Column(nullable = false)
    private Integer adults = 1;

    @Column(nullable = false)
    private Integer children = 0;

    @Column(name = "rate_plan_id")
    private UUID ratePlanId;

    @Column(name = "rate_code", length = 64)
    private String rateCode;

    @Column(name = "nightly_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal nightlyRate = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "packages_json", columnDefinition = "TEXT")
    private String packagesJson;

    @Column(name = "add_ons_json", columnDefinition = "TEXT")
    private String addOnsJson;

    @Column(name = "room_features_json", columnDefinition = "TEXT")
    private String roomFeaturesJson;

    @Column(name = "upgrade_reason", columnDefinition = "TEXT")
    private String upgradeReason;

    @Column(name = "assignment_status", nullable = false, length = 32)
    private String assignmentStatus = "ASSIGNED";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
