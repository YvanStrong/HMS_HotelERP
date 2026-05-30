package com.hms.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "facility_abonnement_facilities",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_facility_abonnement_facility",
                columnNames = {"abonnement_id", "facility_id"}))
@Getter
@Setter
public class FacilityAbonnementFacility {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "abonnement_id", nullable = false)
    private FacilityAbonnement abonnement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;
}
