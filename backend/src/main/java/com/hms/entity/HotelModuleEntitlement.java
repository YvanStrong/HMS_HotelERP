package com.hms.entity;

import com.hms.domain.ModuleBillingStatus;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "hotel_module_entitlements")
@Getter
@Setter
public class HotelModuleEntitlement {

    @EmbeddedId
    private HotelModuleEntitlementId id = new HotelModuleEntitlementId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("hotelId")
    @JoinColumn(name = "hotel_id")
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("moduleId")
    @JoinColumn(name = "module_id")
    private PlatformModule module;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "show_when_disabled", nullable = false)
    private boolean showWhenDisabled = false;

    @Column(name = "billing_status", length = 20)
    private ModuleBillingStatus billingStatus = ModuleBillingStatus.INCLUDED;

    @Column(name = "addon_activated_at")
    private Instant addonActivatedAt;

    @Column(name = "addon_expires_at")
    private Instant addonExpiresAt;

    @Column(name = "enabled_at")
    private Instant enabledAt;

    @Column(name = "disabled_at")
    private Instant disabledAt;

    @PrePersist
    void prePersist() {
        if (enabledAt == null) {
            enabledAt = Instant.now();
        }
    }
}
