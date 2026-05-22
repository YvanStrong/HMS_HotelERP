package com.hms.entity;

import com.hms.domain.FolioStatus;
import com.hms.domain.ReservationStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "reservations")
@Getter
@Setter
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guest_id", nullable = false)
    private Guest guest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_booking_id")
    private GroupBooking groupBooking;

    /** Set when a logged-in guest portal user completes the booking. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booked_by_app_user_id")
    private AppUser bookedByAppUser;

    @Column(name = "confirmation_code", nullable = false, unique = true, length = 32)
    private String confirmationCode;

    @Column(name = "booking_reference", nullable = false, unique = true, length = 32)
    private String bookingReference;

    @Column(name = "booking_source", nullable = false, length = 30)
    private String bookingSource = "FRONT_DESK";

    @Column(name = "check_in_date", nullable = false)
    private LocalDate checkInDate;

    @Column(name = "check_out_date", nullable = false)
    private LocalDate checkOutDate;

    @Column(name = "arrival_time")
    private LocalTime arrivalTime;

    @Column(name = "departure_time")
    private LocalTime departureTime;

    @Column(name = "actual_check_in")
    private Instant actualCheckIn;

    @Column(name = "actual_check_out")
    private Instant actualCheckOut;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_in_by")
    private AppUser checkedInBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_out_by")
    private AppUser checkedOutBy;

    /** Last staff user who changed operational state for this reservation. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_modified_by")
    private AppUser lastModifiedBy;

    @Column(name = "no_show_at")
    private Instant noShowAt;

    @Column(name = "is_early_checkin", nullable = false)
    private boolean earlyCheckin;

    @Column(name = "is_late_checkout", nullable = false)
    private boolean lateCheckout;

    @Column(name = "early_checkin_fee_applied", precision = 12, scale = 2)
    private BigDecimal earlyCheckinFeeApplied;

    @Column(name = "late_checkout_fee_applied", precision = 12, scale = 2)
    private BigDecimal lateCheckoutFeeApplied;

    @Column(name = "guest_id_verified", nullable = false)
    private boolean guestIdVerified;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id_verified_by")
    private AppUser guestIdVerifiedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "folio_status", nullable = false, length = 20)
    private FolioStatus folioStatus = FolioStatus.CLOSED;

    @Column(name = "folio_closed_at")
    private Instant folioClosedAt;

    @Column(nullable = false)
    private Integer adults;

    @Column(nullable = false)
    private Integer children;

    @Column(name = "rooms_requested", nullable = false)
    private Integer roomsRequested = 1;

    @Column(name = "child_ages_json", columnDefinition = "TEXT")
    private String childAgesJson;

    @Column(name = "stay_purpose", length = 64)
    private String stayPurpose;

    @Column(name = "booking_intent", nullable = false, length = 32)
    private String bookingIntent = "NORMAL";

    @Column(name = "waitlist_allowed", nullable = false)
    private boolean waitlistAllowed;

    @Column(name = "flexible_dates", nullable = false)
    private boolean flexibleDates;

    @Column(name = "nightly_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal nightlyRate;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ReservationStatus status;

    @Column(name = "special_requests", columnDefinition = "TEXT")
    private String specialRequests;

    @Column(length = 64)
    private String source;

    @Column(name = "includes_breakfast", nullable = false)
    private boolean includesBreakfast;

    @Column(name = "cancellation_policy", length = 64)
    private String cancellationPolicy;

    @Column(name = "deposit_amount", precision = 14, scale = 2)
    private BigDecimal depositAmount;

    @Column(name = "deposit_paid", nullable = false)
    private boolean depositPaid;

    @Column(name = "deposit_payment_method", length = 30)
    private String depositPaymentMethod;

    @Column(name = "rate_plan_id")
    private UUID ratePlanId;

    @Column(name = "rate_code", length = 64)
    private String rateCode;

    @Column(name = "room_type_to_charge_id")
    private UUID roomTypeToChargeId;

    @Column(name = "manual_rate_override", precision = 14, scale = 2)
    private BigDecimal manualRateOverride;

    @Column(name = "rate_override_reason", columnDefinition = "TEXT")
    private String rateOverrideReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rate_override_approved_by")
    private AppUser rateOverrideApprovedBy;

    @Column(name = "packages_json", columnDefinition = "TEXT")
    private String packagesJson;

    @Column(name = "add_ons_json", columnDefinition = "TEXT")
    private String addOnsJson;

    @Column(name = "room_features_json", columnDefinition = "TEXT")
    private String roomFeaturesJson;

    @Column(name = "upgrade_reason", columnDefinition = "TEXT")
    private String upgradeReason;

    @Column(name = "reservation_type", length = 64)
    private String reservationType;

    @Column(name = "market_code", length = 64)
    private String marketCode;

    @Column(name = "source_code", length = 64)
    private String sourceCode;

    @Column(name = "origin_code", length = 64)
    private String originCode;

    @Column(name = "channel_code", length = 64)
    private String channelCode;

    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "travel_agent_id")
    private UUID travelAgentId;

    @Column(name = "commissionable", nullable = false)
    private boolean commissionable;

    @Column(name = "commission_percent", precision = 5, scale = 2)
    private BigDecimal commissionPercent;

    @Column(name = "promo_code", length = 64)
    private String promoCode;

    @Column(name = "campaign_code", length = 64)
    private String campaignCode;

    @Column(name = "guarantee_type", length = 64)
    private String guaranteeType;

    @Column(name = "deduct_inventory", nullable = false)
    private boolean deductInventory = true;

    @Column(name = "deposit_required", nullable = false)
    private boolean depositRequired;

    @Column(name = "deposit_due_date")
    private LocalDate depositDueDate;

    @Column(name = "payment_status", length = 64)
    private String paymentStatus;

    @Column(name = "payment_token_id", length = 200)
    private String paymentTokenId;

    @Column(name = "authorization_code", length = 128)
    private String authorizationCode;

    @Column(name = "direct_bill_company_id")
    private UUID directBillCompanyId;

    @Column(name = "tax_exempt", nullable = false)
    private boolean taxExempt;

    @Column(name = "tax_exempt_reason", columnDefinition = "TEXT")
    private String taxExemptReason;

    @Column(name = "guarantee_override_reason", columnDefinition = "TEXT")
    private String guaranteeOverrideReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guarantee_override_approved_by")
    private AppUser guaranteeOverrideApprovedBy;

    @Column(name = "cancellation_policy_id", length = 128)
    private String cancellationPolicyId;

    @Column(name = "deposit_policy_id", length = 128)
    private String depositPolicyId;

    @Column(name = "no_show_policy_id", length = 128)
    private String noShowPolicyId;

    @Column(name = "terms_accepted", nullable = false)
    private boolean termsAccepted;

    @Column(name = "terms_accepted_at")
    private Instant termsAcceptedAt;

    @Column(name = "registration_card_signed", nullable = false)
    private boolean registrationCardSigned;

    @Column(name = "policy_snapshot_json", columnDefinition = "TEXT")
    private String policySnapshotJson;

    @Column(name = "arrival_transport_type", length = 64)
    private String arrivalTransportType;

    @Column(name = "flight_number", length = 64)
    private String flightNumber;

    @Column(name = "pickup_required", nullable = false)
    private boolean pickupRequired;

    @Column(name = "pickup_time")
    private Instant pickupTime;

    @Column(name = "late_checkout_requested", nullable = false)
    private boolean lateCheckoutRequested;

    @Column(name = "housekeeping_instructions", columnDefinition = "TEXT")
    private String housekeepingInstructions;

    @Column(name = "amenity_instructions", columnDefinition = "TEXT")
    private String amenityInstructions;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "guest_facing_notes", columnDefinition = "TEXT")
    private String guestFacingNotes;

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
