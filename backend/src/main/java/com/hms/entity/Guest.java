package com.hms.entity;

import com.hms.domain.LoyaltyTier;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "guests")
@Getter
@Setter
public class Guest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portal_account_id")
    private AppUser portalAccount;

    @Column(name = "first_name", nullable = false, length = 128)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 128)
    private String lastName;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "national_id", nullable = false, length = 50)
    private String nationalId;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(length = 100)
    private String nationality;

    @Column(length = 20)
    private String gender;

    @Column(length = 255)
    private String email;

    @Column(length = 64)
    private String phone;

    @Column(name = "phone_country_code", length = 5)
    private String phoneCountryCode;

    @Column(name = "country", nullable = false, length = 100)
    @ColumnDefault("'Rwanda'")
    private String country = "Rwanda";

    @Column(length = 100)
    private String province;

    @Column(length = 100)
    private String district;

    @Column(length = 100)
    private String sector;

    @Column(length = 100)
    private String cell;

    @Column(length = 100)
    private String village;

    @Column(name = "street_number", length = 50)
    private String streetNumber;

    @Column(name = "address_notes", columnDefinition = "TEXT")
    private String addressNotes;

    @Column(name = "id_type", length = 30)
    @ColumnDefault("'NATIONAL_ID'")
    private String idType = "NATIONAL_ID";

    @Column(name = "id_document_type", length = 64)
    private String idDocumentType;

    @Column(name = "id_document_number", nullable = false, length = 128)
    private String idDocumentNumber;

    @Column(name = "id_expiry_date")
    private LocalDate idExpiryDate;

    @Column(name = "vip_level", length = 20)
    @ColumnDefault("'NONE'")
    private String vipLevel = "NONE";

    @Column(name = "is_blacklisted", nullable = false)
    @ColumnDefault("false")
    private boolean blacklisted;

    @Column(name = "blacklist_reason", columnDefinition = "TEXT")
    private String blacklistReason;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "marketing_consent", nullable = false)
    @ColumnDefault("false")
    private boolean marketingConsent;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUser createdBy;

    @Column(name = "preferences_json", columnDefinition = "TEXT")
    private String preferencesJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "loyalty_tier", nullable = false, length = 32)
    @ColumnDefault("'BRONZE'")
    private LoyaltyTier loyaltyTier = LoyaltyTier.BRONZE;

    @Column(name = "loyalty_points", nullable = false)
    @ColumnDefault("0")
    private long loyaltyPoints;

    @Column(name = "tier_valid_until")
    private Instant tierValidUntil;

    @Column(name = "email_opt_in", nullable = false)
    @ColumnDefault("true")
    private boolean emailOptIn = true;

    @Column(name = "sms_opt_in", nullable = false)
    @ColumnDefault("false")
    private boolean smsOptIn;

    @Column(name = "preferred_language", length = 8)
    private String preferredLanguage = "en";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (preferredLanguage == null || preferredLanguage.isBlank()) {
            preferredLanguage = "en";
        }
        if (fullName == null || fullName.isBlank()) {
            fullName = (firstName != null ? firstName : "").trim() + " " + (lastName != null ? lastName : "").trim();
        }
        if (idDocumentNumber == null || idDocumentNumber.isBlank()) {
            idDocumentNumber = nationalId;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
