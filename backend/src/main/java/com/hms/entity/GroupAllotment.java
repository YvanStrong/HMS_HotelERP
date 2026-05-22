package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "group_allotments")
@Getter
@Setter
public class GroupAllotment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_booking_id", nullable = false)
    private GroupBooking groupBooking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    @Column(name = "allotment_date", nullable = false)
    private LocalDate allotmentDate;

    @Column(name = "contracted_rooms", nullable = false)
    private Integer contractedRooms = 0;

    @Column(name = "picked_up_rooms", nullable = false)
    private Integer pickedUpRooms = 0;

    @Column(name = "released_rooms", nullable = false)
    private Integer releasedRooms = 0;

    @Column(name = "washed_rooms", nullable = false)
    private Integer washedRooms = 0;

    @Column(name = "rate_amount", precision = 14, scale = 2)
    private BigDecimal rateAmount;

    @Column(name = "release_date")
    private LocalDate releaseDate;

    @Column(nullable = false, length = 32)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
