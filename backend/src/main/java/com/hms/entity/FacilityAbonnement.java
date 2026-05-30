package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "facility_abonnements",
        uniqueConstraints = @UniqueConstraint(name = "uq_facility_abonnement_hotel_code", columnNames = {"hotel_id", "code"}))
@Getter
@Setter
public class FacilityAbonnement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "member_name", nullable = false, length = 255)
    private String memberName;

    @Column(name = "company_name", length = 255)
    private String companyName;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "contact_phone", length = 64)
    private String contactPhone;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_until", nullable = false)
    private LocalDate validUntil;

    @Column(name = "visit_limit")
    private Integer visitLimit;

    @Column(name = "visits_used", nullable = false)
    private int visitsUsed;

    @Column(name = "monthly_billing", nullable = false)
    private boolean monthlyBilling;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @OneToMany(mappedBy = "abonnement", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FacilityAbonnementFacility> allowedFacilities = new ArrayList<>();

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
