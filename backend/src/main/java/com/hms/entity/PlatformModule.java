package com.hms.entity;

import com.hms.domain.ModuleTier;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "platform_modules")
@Getter
@Setter
public class PlatformModule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "module_key", nullable = false, unique = true, length = 50)
    private String moduleKey;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "nav_section", length = 50)
    private String navSection;

    @Column(nullable = false, length = 20)
    private ModuleTier tier = ModuleTier.DEFAULT;

    @Column(name = "is_locked", nullable = false)
    private boolean locked;

    @Column(name = "is_paid_addon", nullable = false)
    private boolean paidAddon;

    @Column(name = "price_per_month", precision = 10, scale = 2)
    private BigDecimal pricePerMonth;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}
