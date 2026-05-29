package com.hms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@EqualsAndHashCode
public class HotelModuleEntitlementId implements Serializable {

    @Column(name = "hotel_id")
    private UUID hotelId;

    @Column(name = "module_id")
    private UUID moduleId;
}
