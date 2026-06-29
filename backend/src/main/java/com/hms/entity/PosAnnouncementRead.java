package com.hms.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "pos_announcement_reads")
@Getter
@Setter
@IdClass(PosAnnouncementRead.AnnouncementReadId.class)
public class PosAnnouncementRead {

    @jakarta.persistence.Id
    @Column(name = "announcement_id")
    private UUID announcementId;

    @jakarta.persistence.Id
    @Column(name = "user_id")
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private PosAnnouncement announcement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private AppUser user;

    @Column(name = "read_at", nullable = false)
    private Instant readAt;

    @PrePersist
    void prePersist() {
        if (readAt == null) {
            readAt = Instant.now();
        }
    }

    public record AnnouncementReadId(UUID announcementId, UUID userId) implements Serializable {}
}
