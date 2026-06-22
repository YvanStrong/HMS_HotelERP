package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "hr_leave_balances")
@Getter
@Setter
public class HrLeaveBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leave_type_id", nullable = false)
    private HrLeaveType leaveType;

    @Column(nullable = false)
    private int year;

    @Column(name = "days_allocated", nullable = false, precision = 5, scale = 1)
    private BigDecimal daysAllocated = BigDecimal.ZERO;

    @Column(name = "days_used", nullable = false, precision = 5, scale = 1)
    private BigDecimal daysUsed = BigDecimal.ZERO;

    @Column(name = "days_pending", nullable = false, precision = 5, scale = 1)
    private BigDecimal daysPending = BigDecimal.ZERO;

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
