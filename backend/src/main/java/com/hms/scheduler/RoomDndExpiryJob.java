package com.hms.scheduler;

import com.hms.repository.RoomRepository;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class RoomDndExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(RoomDndExpiryJob.class);

    private final RoomRepository roomRepository;

    public RoomDndExpiryJob(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    /** Clears DND where {@code dnd_until} is in the past (Phase 1 Step 4). */
    @Scheduled(fixedRateString = "${hms.dnd.expiry-poll-ms:900000}")
    @Transactional
    public void clearExpiredDnd() {
        int n = roomRepository.clearExpiredDnd(Instant.now());
        if (n > 0) {
            log.info("Cleared expired DND on {} room(s)", n);
        }
    }
}
