package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "inv_warehouses",
       uniqueConstraints = @UniqueConstraint(name = "uq_inv_warehouse_hotel_code", columnNames = {"hotel_id", "code"}))
@Getter
@Setter
public class InvWarehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false, length = 32)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
