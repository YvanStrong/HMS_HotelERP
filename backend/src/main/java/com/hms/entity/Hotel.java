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

    @Column(name = "company_name", length = 255)
    private String companyName;

    @Column(nullable = false, unique = true, length = 64)
    private String code;

    @Column(nullable = false, length = 64)
    private String timezone = "UTC";

    @Column(nullable = false, length = 8)
    private String currency = "USD";

    @Column(name = "default_country", length = 100)
    private String defaultCountry;

    @Column(name = "default_id_type", length = 30)
    private String defaultIdType;

    @Column(name = "phone_country_code", length = 5)
    private String phoneCountryCode;

    @Column(name = "invoice_prefix", length = 20)
    private String invoicePrefix;

    @Column(name = "check_in_time", length = 5)
    private String checkInTime;

    @Column(name = "check_out_time", length = 5)
    private String checkOutTime;

    @Column(name = "tax_rate", precision = 5, scale = 2)
    private BigDecimal taxRate;

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

    @Column(name = "tin_number", length = 64)
    private String tinNumber;

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

    @Column(name = "overstay_auto_post_enabled", nullable = false)
    private boolean overstayAutoPostEnabled = false;

    @Column(name = "overstay_grace_minutes", nullable = false)
    private Integer overstayGraceMinutes = 60;

    @Column(name = "overstay_hourly_percent", precision = 5, scale = 2, nullable = false)
    private BigDecimal overstayHourlyPercent = new BigDecimal("1.50");

    @Column(name = "overstay_half_day_cap_percent", precision = 5, scale = 2, nullable = false)
    private BigDecimal overstayHalfDayCapPercent = new BigDecimal("50.00");

    @Column(name = "overstay_full_day_after_hours", nullable = false)
    private Integer overstayFullDayAfterHours = 6;

    @Column(name = "overstay_max_daily_percent", precision = 5, scale = 2, nullable = false)
    private BigDecimal overstayMaxDailyPercent = new BigDecimal("100.00");

    @Column(name = "overstay_apply_tax", nullable = false)
    private boolean overstayApplyTax = true;

    @Column(name = "overstay_post_timing", nullable = false, length = 32)
    private String overstayPostTiming = "AT_CHECKOUT";

    /**
     * When set, the public kitchen board requires query {@code ?key=<this value>} (constant-time compare).
     * Stored as plain text; treat like a password — only put on trusted displays.
     */
    @Column(name = "order_board_secret", length = 128)
    private String orderBoardSecret;

    /**
     * When true, {@code /self-order/pickup-board} returns cards without {@code pickupDisplayName}. Kitchen board API is
     * unaffected.
     */
    @Column(name = "pickup_board_hide_guest_names", nullable = false)
    private boolean pickupBoardHideGuestNames = false;

    /** When false, SMS READY alerts are skipped for this hotel even if Twilio is globally configured. */
    @Column(name = "self_order_sms_enabled", nullable = false)
    private boolean selfOrderSmsEnabled = true;

    /** When false, Web Push READY alerts are skipped for this hotel even if VAPID is globally configured. */
    @Column(name = "self_order_push_enabled", nullable = false)
    private boolean selfOrderPushEnabled = true;

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
