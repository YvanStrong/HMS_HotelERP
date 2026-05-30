package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "inv_fabrication_formula_lines")
@Getter
@Setter
public class InvFabricationFormulaLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "formula_id", nullable = false)
    private InvFabricationFormula formula;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "component_id", nullable = false)
    private InventoryItem component;

    @Column(nullable = false, precision = 14, scale = 4)
    private BigDecimal quantity;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
