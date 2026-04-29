package com.hms.entity;

import com.hms.domain.FolioStatus;
import com.hms.domain.ReservationStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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
