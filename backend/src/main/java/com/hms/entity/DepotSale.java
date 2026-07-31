package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "depot_sales")
@Getter
@Setter
public class DepotSale {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "depot_id", nullable = false)
    private InventoryDepot depot;

    @Column(name = "sale_number", nullable = false, length = 48, unique = true)
    private String saleNumber;

    @Column(name = "customer_name", length = 160)
    private String customerName;

    @Column(name = "customer_tin", length = 16)
    private String customerTin;

    @Column(name = "table_label", length = 255)
    private String tableLabel;

    @Column(name = "payment_method", nullable = false, length = 32)
    private String paymentMethod = "CASH";

    /** Currency the customer paid in (USD/EUR/…). Null means hotel base currency. */
    @Column(name = "payment_currency", length = 3)
    private String paymentCurrency;

    /** Hotel-currency units per 1 unit of payment_currency (e.g. RWF per USD). */
    @Column(name = "exchange_rate", precision = 18, scale = 6)
    private BigDecimal exchangeRate;

    /** Amount received in payment_currency. */
    @Column(name = "foreign_amount", precision = 14, scale = 2)
    private BigDecimal foreignAmount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_user_id")
    private AppUser staffUser;

    @Column(name = "subtotal_amount", precision = 14, scale = 2)
    private BigDecimal subtotalAmount;

    @Column(name = "discount_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "promo_code", length = 30)
    private String promoCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promotion_id")
    private Promotion promotion;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "status", nullable = false, length = 16)
    private String status = "COMPLETED";

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DepotSaleLine> lines = new ArrayList<>();

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
