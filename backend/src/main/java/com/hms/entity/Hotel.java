package com.hms.entity;

import com.hms.domain.SubscriptionStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "hotels")
@Getter
@Setter
public class Hotel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true, length = 64)
    private String code;

    @Column(nullable = false, length = 64)
    private String timezone = "UTC";

    @Column(nullable = false, length = 8)
    private String currency = "USD";

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_status", nullable = false, length = 32)
    private SubscriptionStatus subscriptionStatus;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 64)
    private String phone;

    @Column(length = 255)
    private String email;

    /** Large values (e.g. base64 {@code data:} URLs from the admin image uploader) exceed {@code varchar(2048)}. */
    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "logo_url", columnDefinition = "TEXT")
    private String logoUrl;

    @Column(name = "star_rating")
    private Integer starRating;

    @Column(name = "early_checkin_fee", precision = 12, scale = 2)
    private BigDecimal earlyCheckinFee = BigDecimal.ZERO;

    @Column(name = "late_checkout_fee", precision = 12, scale = 2)
    private BigDecimal lateCheckoutFee = BigDecimal.ZERO;

    @Column(name = "no_show_default_fee", precision = 12, scale = 2)
    private BigDecimal noShowDefaultFee = new BigDecimal("50.00");

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
