package com.hms.entity;

import com.hms.domain.ShiftStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "pos_shifts")
@Getter
@Setter
public class PosShift {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "depot_id", nullable = false)
    private InventoryDepot depot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "waiter_user_id", nullable = false)
    private AppUser waiterUser;

    @Column(name = "waiter_name", nullable = false, length = 150)
    private String waiterName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ShiftStatus status = ShiftStatus.OPEN;

    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "opening_float", nullable = false, precision = 12, scale = 2)
    private BigDecimal openingFloat = BigDecimal.ZERO;

    @Column(name = "total_orders")
    private Integer totalOrders = 0;

    @Column(name = "total_covers")
    private Integer totalCovers = 0;

    @Column(name = "total_cash", precision = 12, scale = 2)
    private BigDecimal totalCash = BigDecimal.ZERO;

    @Column(name = "total_card", precision = 12, scale = 2)
    private BigDecimal totalCard = BigDecimal.ZERO;

    @Column(name = "total_room_charge", precision = 12, scale = 2)
    private BigDecimal totalRoomCharge = BigDecimal.ZERO;

    @Column(name = "total_revenue", precision = 12, scale = 2)
    private BigDecimal totalRevenue = BigDecimal.ZERO;

    @Column(name = "total_tax", precision = 12, scale = 2)
    private BigDecimal totalTax = BigDecimal.ZERO;

    @Column(name = "total_cancelled")
    private Integer totalCancelled = 0;

    @Column(name = "avg_ticket_value", precision = 12, scale = 2)
    private BigDecimal avgTicketValue = BigDecimal.ZERO;

    @Column(name = "avg_serve_time_min", precision = 8, scale = 2)
    private BigDecimal avgServeTimeMin = BigDecimal.ZERO;

    @Column(name = "closing_cash", precision = 12, scale = 2)
    private BigDecimal closingCash;

    @Column(name = "cash_variance", precision = 12, scale = 2)
    private BigDecimal cashVariance;

    @Column(name = "closing_notes", columnDefinition = "TEXT")
    private String closingNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private AppUser closedBy;

    @OneToMany(mappedBy = "shift", fetch = FetchType.LAZY)
    private List<PosTableTicket> tickets = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (openedAt == null) {
            openedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
