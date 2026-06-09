package com.hms.entity;

import com.hms.domain.EventQuoteStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "event_quote",
        uniqueConstraints = @UniqueConstraint(name = "uq_event_quote_event", columnNames = {"event_booking_id"}))
@Getter
@Setter
public class EventQuote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_booking_id", nullable = false)
    private GroupBooking groupBooking;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_booking_id", nullable = false, unique = true)
    private EventBooking eventBooking;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EventQuoteStatus status = EventQuoteStatus.DRAFT;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "discount_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "deposit_required", nullable = false, precision = 14, scale = 2)
    private BigDecimal depositRequired = BigDecimal.ZERO;

    @Column(name = "deposit_paid", nullable = false)
    private boolean depositPaid;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "client_notes", columnDefinition = "TEXT")
    private String clientNotes;

    @Column(name = "charges_posted_at")
    private Instant chargesPostedAt;

    @Column(name = "charges_reversed_at")
    private Instant chargesReversedAt;

    @OneToMany(mappedBy = "eventQuote", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EventQuoteLine> lines = new ArrayList<>();

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
