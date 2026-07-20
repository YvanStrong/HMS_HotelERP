package com.hms.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "ebm_sync_cursor")
@Getter
@Setter
@IdClass(EbmSyncCursor.Pk.class)
public class EbmSyncCursor {

    @Id
    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Id
    @Column(nullable = false, length = 32)
    private String category;

    @Column(name = "last_req_dt")
    private Instant lastReqDt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    @Getter
    @Setter
    public static class Pk implements Serializable {
        private UUID deviceId;
        private String category;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pk pk)) return false;
            return Objects.equals(deviceId, pk.deviceId) && Objects.equals(category, pk.category);
        }

        @Override
        public int hashCode() {
            return Objects.hash(deviceId, category);
        }
    }
}
