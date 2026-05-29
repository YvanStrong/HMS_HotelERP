package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "hotel_module_audit_log")
@Getter
@Setter
public class HotelModuleAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hotel_id", nullable = false)
    private UUID hotelId;

    @Column(name = "module_key", nullable = false, length = 50)
    private String moduleKey;

    @Column(name = "old_enabled")
    private Boolean oldEnabled;

    @Column(name = "new_enabled")
    private Boolean newEnabled;

    @Column(name = "old_billing", length = 20)
    private String oldBilling;

    @Column(name = "new_billing", length = 20)
    private String newBilling;

    @Column(name = "changed_by")
    private UUID changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @PrePersist
    void prePersist() {
        if (changedAt == null) {
            changedAt = Instant.now();
        }
    }
}
