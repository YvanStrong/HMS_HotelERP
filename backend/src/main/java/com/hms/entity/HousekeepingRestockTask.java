package com.hms.entity;

import com.hms.domain.RestockTaskStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "housekeeping_restock_tasks")
@Getter
@Setter
public class HousekeepingRestockTask {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem inventoryItem;

    @Column(name = "sku_snapshot", length = 128)
    private String skuSnapshot;

    @Column(name = "item_name_snapshot", length = 255)
    private String itemNameSnapshot;

    @Column(name = "quantity_suggested", nullable = false, precision = 14, scale = 4)
    private BigDecimal quantitySuggested;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private RestockTaskStatus status = RestockTaskStatus.OPEN;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
