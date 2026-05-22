package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "reservation_guests")
@Getter
@Setter
public class ReservationGuest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private Guest guest;

    @Column(nullable = false, length = 32)
    private String role = "COMPANION";

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "preferred_name", length = 120)
    private String preferredName;

    @Column(length = 128)
    private String email;

    @Column(length = 64)
    private String phone;

    @Column(length = 64)
    private String nationality;

    @Column(name = "id_document_type", length = 64)
    private String idDocumentType;

    @Column(name = "id_document_number", length = 100)
    private String idDocumentNumber;

    @Column(name = "id_expiry_date")
    private LocalDate idExpiryDate;

    @Column(name = "preferred_language", length = 32)
    private String preferredLanguage;

    @Column(name = "communication_preference", length = 32)
    private String communicationPreference;

    @Column(name = "operational_message_consent", nullable = false)
    private boolean operationalMessageConsent;

    @Column(name = "accessibility_needs", columnDefinition = "TEXT")
    private String accessibilityNeeds;

    @Column(name = "dietary_restrictions", columnDefinition = "TEXT")
    private String dietaryRestrictions;

    @Column(columnDefinition = "TEXT")
    private String allergies;

    @Column(name = "room_feature_preferences", columnDefinition = "TEXT")
    private String roomFeaturePreferences;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
