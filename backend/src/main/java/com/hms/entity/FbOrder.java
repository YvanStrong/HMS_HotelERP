package com.hms.entity;

import com.hms.domain.FbOrderStatus;
import com.hms.domain.FbOrderType;
import com.hms.domain.FbPaymentStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "fb_orders")
@Getter
@Setter
public class FbOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "outlet_id", nullable = false)
    private FbOutlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id")
    private Reservation guestReservation;

    @Column(name = "order_number", nullable = false, unique = true, length = 48)
    private String orderNumber;

    @Column(name = "order_time", nullable = false)
    private Instant orderTime = Instant.now();

    @Column(name = "served_time")
    private Instant servedTime;

    @Column(name = "closed_time")
    private Instant closedTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FbOrderType orderType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FbOrderStatus status = FbOrderStatus.OPEN;

    @Column(precision = 14, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(precision = 14, scale = 2)
    private BigDecimal tax = BigDecimal.ZERO;

    @Column(precision = 14, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 32)
    private FbPaymentStatus paymentStatus = FbPaymentStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_charge_id")
    private RoomCharge roomCharge;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineOrder ASC")
    private List<FbOrderLine> lines = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (orderTime == null) {
            orderTime = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
