package com.hms.entity;

import com.hms.domain.BanquetEventOrderStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "banquet_event_order",
        uniqueConstraints = @UniqueConstraint(name = "uq_banquet_event_order_event", columnNames = {"event_booking_id"}))
@Getter
@Setter
public class BanquetEventOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_booking_id", nullable = false, unique = true)
    private EventBooking eventBooking;

    @Column(nullable = false)
    private int version = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private BanquetEventOrderStatus status = BanquetEventOrderStatus.DRAFT;

    @Column(name = "distributed_at")
    private Instant distributedAt;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "agenda_items", columnDefinition = "TEXT")
    private String agendaItems;

    @Column(name = "setup_style", length = 80)
    private String setupStyle;

    @Column(name = "room_layout_notes", columnDefinition = "TEXT")
    private String roomLayoutNotes;

    @Column(name = "expected_pax")
    private Integer expectedPax;

    @Column(name = "guaranteed_pax")
    private Integer guaranteedPax;

    @Column(name = "av_requirements", columnDefinition = "TEXT")
    private String avRequirements;

    @Column(name = "equipment_list", columnDefinition = "TEXT")
    private String equipmentList;

    @Column(name = "menu_notes", columnDefinition = "TEXT")
    private String menuNotes;

    @Column(name = "dietary_restrictions", columnDefinition = "TEXT")
    private String dietaryRestrictions;

    @Column(name = "service_timings", columnDefinition = "TEXT")
    private String serviceTimings;

    @Column(name = "beverage_notes", columnDefinition = "TEXT")
    private String beverageNotes;

    @Column(name = "banquet_staff_count")
    private Integer banquetStaffCount;

    @Column(name = "kitchen_notes", columnDefinition = "TEXT")
    private String kitchenNotes;

    @Column(name = "housekeeping_notes", columnDefinition = "TEXT")
    private String housekeepingNotes;

    @Column(name = "maintenance_notes", columnDefinition = "TEXT")
    private String maintenanceNotes;

    @Column(name = "security_notes", columnDefinition = "TEXT")
    private String securityNotes;

    @Column(name = "finance_notes", columnDefinition = "TEXT")
    private String financeNotes;

    @Column(name = "deposit_confirmed", nullable = false)
    private boolean depositConfirmed;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @Column(name = "last_updated_by", length = 120)
    private String lastUpdatedBy;

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
