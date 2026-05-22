package com.hms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Represents a group booking (e.g., corporate event, wedding, tour group).
 * Allows managing multiple reservations under a single entity with a master folio.
 */
@Entity
@Table(name = "group_bookings")
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class GroupBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    @JsonIgnore
    private Hotel hotel;

    @Column(name = "group_name", nullable = false, length = 200)
    private String groupName;

    @Column(name = "group_code", unique = true, length = 50)
    private String groupCode;

    @Column(name = "company_name", length = 200)
    private String companyName;

    @Column(name = "contact_person", length = 128)
    private String contactPerson;

    @Column(name = "contact_email", length = 128)
    private String contactEmail;

    @Column(name = "contact_phone", length = 64)
    private String contactPhone;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "TENTATIVE"; // TENTATIVE, CONFIRMED, CANCELLED, COMPLETED

    @OneToMany(mappedBy = "groupBooking", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Reservation> reservations = new ArrayList<>();

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    /** Expected headcount for the event (not necessarily 1:1 with rooms). */
    @Column(name = "expected_guests")
    private Integer expectedGuests;

    /** Target number of physical rooms to hold for the group. */
    @Column(name = "rooms_needed")
    private Integer roomsNeeded;

    @Column(name = "target_check_in")
    private LocalDate targetCheckIn;

    @Column(name = "target_check_out")
    private LocalDate targetCheckOut;

    /** e.g. CONFERENCE, WEDDING, TOUR, SPORTS_TEAM, CORPORATE_RETREAT */
    @Column(name = "event_type", length = 64)
    private String eventType;

    /** Free-text rooming wish list, e.g. "3×Deluxe Twin + 2×King". */
    @Column(name = "room_mix_summary", length = 500)
    private String roomMixSummary;

    /** Primary room type targeted for this block (see reserve-block flow). */
    @Column(name = "preferred_room_type_id")
    private UUID preferredRoomTypeId;

    /** MASTER_PAYS_ALL, SPLIT_BILLING, GUEST_PAYS_INCIDENTALS — enforced by {@link com.hms.service.GroupBillingRouter}. */
    @Column(name = "billing_preference", length = 32)
    private String billingPreference;

    @Column(name = "release_date")
    private LocalDate releaseDate;

    @Column(name = "cutoff_date")
    private LocalDate cutoffDate;

    @Column(name = "attrition_percent", precision = 5, scale = 2)
    private java.math.BigDecimal attritionPercent;

    @Column(name = "attendee_booking_link_enabled", nullable = false)
    private boolean attendeeBookingLinkEnabled;

    @Column(name = "beo_required", nullable = false)
    private boolean beoRequired;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "master_reservation_id")
    @JsonIgnore
    private Reservation masterReservation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corporate_account_id")
    @JsonIgnore
    private CorporateAccount corporateAccount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
