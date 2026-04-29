package com.hms.entity;

import com.hms.domain.InventoryItemType;
import com.hms.domain.ValuationMethod;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "inventory_items",
        uniqueConstraints = @UniqueConstraint(name = "uk_inv_item_hotel_sku", columnNames = {"hotel_id", "sku"}))
@Getter
@Setter
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private InventoryCategory category;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 128)
    private String sku;

    @Column(length = 128)
    private String barcode;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private InventoryItemType type = InventoryItemType.CONSUMABLE;

    @Column(name = "current_stock", nullable = false, precision = 14, scale = 4)
    private BigDecimal currentStock = BigDecimal.ZERO;

    @Column(name = "minimum_stock", precision = 14, scale = 4)
    private BigDecimal minimumStock = BigDecimal.ZERO;

    @Column(name = "maximum_stock", precision = 14, scale = 4)
    private BigDecimal maximumStock;

    @Column(name = "reorder_point", precision = 14, scale = 4)
    private BigDecimal reorderPoint = BigDecimal.ZERO;

    @Column(name = "unit_of_measure", length = 32)
    private String unitOfMeasure = "piece";

    @Column(name = "unit_cost", precision = 14, scale = 4)
    private BigDecimal unitCost = BigDecimal.ZERO;

    @Column(name = "last_purchase_price", precision = 14, scale = 4)
    private BigDecimal lastPurchasePrice;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private ValuationMethod valuation = ValuationMethod.AVERAGE_COST;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preferred_supplier_id")
    private Supplier preferredSupplier;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @Column(name = "is_minibar_item", nullable = false)
    private boolean minibarItem;

    @Column(name = "minibar_reorder_threshold")
    private Integer minibarReorderThreshold;

    @OneToMany(mappedBy = "item", cascade = CascadeType.ALL)
    private List<StockTransaction> transactions = new ArrayList<>();

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
