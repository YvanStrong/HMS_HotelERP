package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "reservation_policy_snapshots")
@Getter
@Setter
public class ReservationPolicySnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @Column(name = "cancellation_policy_id", length = 128)
    private String cancellationPolicyId;

    @Column(name = "deposit_policy_id", length = 128)
    private String depositPolicyId;

    @Column(name = "no_show_policy_id", length = 128)
    private String noShowPolicyId;

    @Column(name = "cancellation_summary", columnDefinition = "TEXT")
    private String cancellationSummary;

    @Column(name = "deposit_summary", columnDefinition = "TEXT")
    private String depositSummary;

    @Column(name = "no_show_summary", columnDefinition = "TEXT")
    private String noShowSummary;

    @Column(name = "policy_snapshot_json", columnDefinition = "TEXT")
    private String policySnapshotJson;

    @Column(name = "terms_accepted", nullable = false)
    private boolean termsAccepted;

    @Column(name = "terms_accepted_at")
    private Instant termsAcceptedAt;

    @Column(name = "registration_card_signed", nullable = false)
    private boolean registrationCardSigned;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
