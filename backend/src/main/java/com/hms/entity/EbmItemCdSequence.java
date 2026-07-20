package com.hms.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "ebm_item_cd_sequence")
@Getter
@Setter
public class EbmItemCdSequence {

    @Id
    @Column(name = "hotel_id")
    private UUID hotelId;

    @Column(name = "last_number", nullable = false)
    private long lastNumber = 0;
}
