package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "taxable_sale_event",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_taxable_sale_source",
                        columnNames = {"source_type", "source_id"}))
@Getter
@Setter
public class TaxableSaleEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id")
    private EbmDevice device;

    @Column(name = "source_type", nullable = false, length = 24)
    private String sourceType;

    @Column(name = "source_id", nullable = false)
    private UUID sourceId;

    @Column(name = "document_number", length = 64)
    private String documentNumber;

    @Column(name = "ebm_receipt_no", length = 64)
    private String ebmReceiptNo;

    @Column(name = "ebm_signature", columnDefinition = "TEXT")
    private String ebmSignature;

    @Column(name = "ebm_qr_payload", columnDefinition = "TEXT")
    private String ebmQrPayload;

    @Column(name = "ebm_status", nullable = false, length = 16)
    private String ebmStatus = "PENDING";

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
