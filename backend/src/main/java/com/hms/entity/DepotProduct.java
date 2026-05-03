package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "depot_products",
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_depot_product_hotel_number", columnNames = {"hotel_id", "product_number"}),
            @UniqueConstraint(name = "uk_depot_product_hotel_code", columnNames = {"hotel_id", "product_code"})
        })
@Getter
@Setter
public class DepotProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "depot_id", nullable = false)
    private InventoryDepot depot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id")
    private InventoryItem inventoryItem;

    @Column(name = "product_number", nullable = false)
    private Integer productNumber;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "product_code", nullable = false, length = 32)
    private String productCode;

    @Column(name = "batch_no", nullable = false, length = 64)
    private String batchNo = "NA";

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "cost_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal costPrice = BigDecimal.ZERO;

    @Column(name = "selling_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal sellingPrice = BigDecimal.ZERO;

    @Column(name = "stock_qty", nullable = false, precision = 14, scale = 3)
    private BigDecimal stockQty = BigDecimal.ZERO;

    @Column(name = "stock_type", nullable = false, length = 16)
    private String stockType = "STOCK";

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    /** Menu grouping inside depot (e.g. SOFT_DRINKS, HOT_DRINKS, PASTRIES). */
    @Column(name = "menu_name", nullable = false, length = 80)
    private String menuName = "GENERAL";

    /** When true, receipt shows 18% VAT extracted from VAT-inclusive selling price. */
    @Column(name = "taxable", nullable = false)
    private boolean taxable = true;

    @Column(name = "is_active", nullable = false)
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
        if (batchNo == null || batchNo.isBlank()) {
            batchNo = "NA";
        }
        if (menuName == null || menuName.isBlank()) {
            menuName = "GENERAL";
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
