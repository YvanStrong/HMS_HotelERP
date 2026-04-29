package com.hms.entity;

import com.hms.domain.PlatformBillingCycle;
import com.hms.domain.PlatformBillingStatus;
import com.hms.domain.ProvisioningStatus;
import com.hms.domain.SubscriptionTier;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "platform_tenants")
@Getter
@Setter
public class PlatformTenant {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "id")
    private Hotel hotel;

    @Column(name = "hotel_name", nullable = false, length = 255)
    private String hotelName;

    @Column(nullable = false, unique = true, length = 128)
    private String subdomain;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "contact_phone", length = 64)
    private String contactPhone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private SubscriptionTier tier = SubscriptionTier.STARTER;

    @Column(name = "subscription_start", nullable = false)
    private Instant subscriptionStart;

    @Column(name = "subscription_end")
    private Instant subscriptionEnd;

    @Enumerated(EnumType.STRING)
    @Column(name = "billing_cycle", nullable = false, length = 32)
    private PlatformBillingCycle billingCycle = PlatformBillingCycle.MONTHLY;

    @Column(name = "max_rooms")
    private Integer maxRooms;

    @Column(name = "max_users")
    private Integer maxUsers;

    @Column(name = "max_reservations_per_month")
    private Integer maxReservationsPerMonth;

    @Column(name = "feature_advanced_reporting", nullable = false)
    private boolean featuresAdvancedReporting;

    @Column(name = "feature_channel_manager", nullable = false)
    private boolean featuresChannelManager;

    @Column(name = "feature_mobile_app", nullable = false)
    private boolean featuresMobileApp;

    @Column(name = "monthly_price", precision = 14, scale = 2)
    private BigDecimal monthlyPrice;

    @Column(name = "payment_method_id", length = 128)
    private String paymentMethodId;

    @Column(name = "stripe_customer_id", length = 128)
    private String stripeCustomerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "billing_status", nullable = false, length = 32)
    private PlatformBillingStatus billingStatus = PlatformBillingStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "provisioning_status", nullable = false, length = 32)
    private ProvisioningStatus provisioningStatus = ProvisioningStatus.PROVISIONED;

    @Column(name = "database_schema", length = 128)
    private String databaseSchema;

    @Column(name = "aws_account_id", length = 64)
    private String awsAccountId;
}
