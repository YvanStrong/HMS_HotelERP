package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "ebm_device",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_ebm_device_hotel_serial",
                        columnNames = {"hotel_id", "device_serial_no"}))
@Getter
@Setter
public class EbmDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(nullable = false, length = 8)
    private String mode = "VSDC";

    @Column(nullable = false, length = 32)
    private String tin;

    @Column(name = "branch_id", length = 32)
    private String branchId;

    @Column(name = "device_serial_no", nullable = false, length = 64)
    private String deviceSerialNo;

    @Column(name = "sdc_id", length = 64)
    private String sdcId;

    @Column(name = "mrc_no", length = 64)
    private String mrcNo;

    @Column(name = "encrypted_signing_key", columnDefinition = "TEXT")
    private String encryptedSigningKey;

    @Column(name = "key_version", nullable = false)
    private int keyVersion = 1;

    @Column(name = "vsdc_endpoint_url", columnDefinition = "TEXT")
    private String vsdcEndpointUrl;

    @Column(nullable = false, length = 16)
    private String status = "PENDING_INIT";

    @Column(name = "last_signature_at")
    private Instant lastSignatureAt;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

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

    public boolean isActive() {
        return "ACTIVE".equals(status);
    }
}
