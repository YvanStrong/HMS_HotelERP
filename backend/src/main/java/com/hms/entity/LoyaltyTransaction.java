package com.hms.entity;

import com.hms.domain.LoyaltyTxnStatus;
import com.hms.domain.LoyaltyTxnType;
import com.hms.domain.RedemptionType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "loyalty_transactions")
@Getter
@Setter
public class LoyaltyTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guest_id", nullable = false)
    private Guest guest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private LoyaltyTxnType type;

    @Column(nullable = false)
    private long points;

    @Column(length = 255)
    private String reference;

    @Column(length = 512)
    private String description;

    @Column(name = "transaction_date", nullable = false)
    private Instant transactionDate = Instant.now();

    @Column(name = "expiry_date")
    private Instant expiryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private LoyaltyTxnStatus status = LoyaltyTxnStatus.POSTED;

    @Enumerated(EnumType.STRING)
    @Column(name = "redemption_type", length = 32)
    private RedemptionType redemptionType;

    @Column(name = "redemption_value", precision = 14, scale = 2)
    private BigDecimal redemptionValue;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (transactionDate == null) {
            transactionDate = Instant.now();
        }
    }
}
