package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "inv_fabrication_run_lines")
@Getter
@Setter
public class InvFabricationRunLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private InvFabricationRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "component_id", nullable = false)
    private InventoryItem component;

    @Column(name = "required_quantity", nullable = false, precision = 14, scale = 4)
    private BigDecimal requiredQuantity;

    @Column(name = "stock_before", nullable = false, precision = 14, scale = 4)
    private BigDecimal stockBefore;

    @Column(name = "stock_after", nullable = false, precision = 14, scale = 4)
    private BigDecimal stockAfter;
}
