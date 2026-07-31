package com.hms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
        name = "ebm_code_list",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uq_ebm_code_list",
                        columnNames = {"hotel_id", "category", "code"}))
@Getter
@Setter
public class EbmCodeListEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id")
    private EbmDevice device;

    @Column(nullable = false, length = 32)
    private String category;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(length = 255)
    private String name;

    @Column(name = "parent_code", length = 64)
    private String parentCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_json", columnDefinition = "jsonb")
    private Map<String, Object> rawJson;

    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        syncedAt = Instant.now();
    }
}
