package com.hms.entity;

import com.hms.domain.FbMenuItemKind;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "menu_items", uniqueConstraints = @UniqueConstraint(name = "uk_menu_outlet_code", columnNames = {"outlet_id", "code"}))
@Getter
@Setter
public class MenuItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "outlet_id", nullable = false)
    private FbOutlet outlet;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FbMenuItemKind itemKind = FbMenuItemKind.FOOD;

    @ElementCollection
    @CollectionTable(name = "menu_item_categories", joinColumns = @JoinColumn(name = "menu_item_id"))
    @Column(name = "category", length = 64)
    private List<String> categories = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "menu_item_allergens", joinColumns = @JoinColumn(name = "menu_item_id"))
    @Column(name = "allergen", length = 64)
    private List<String> allergens = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_inventory_item_id")
    private InventoryItem linkedInventoryItem;

    @Column(name = "portion_size")
    private Integer portionSize;

    @Column(name = "available", nullable = false)
    private boolean available = true;

    @Column(name = "prep_time_minutes")
    private Integer prepTimeMinutes = 15;

    @Column(name = "image_url", length = 512)
    private String imageUrl;

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
