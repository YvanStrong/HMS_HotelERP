package com.hms.scheduler;

import com.hms.service.RoomManagementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class RoomBlockAutoReleaseJob {

    private static final Logger log = LoggerFactory.getLogger(RoomBlockAutoReleaseJob.class);

    private final RoomManagementService roomManagementService;

    public RoomBlockAutoReleaseJob(RoomManagementService roomManagementService) {
        this.roomManagementService = roomManagementService;
    }

    /** Releases operational holds where {@code auto_release} and {@code blocked_until_instant} are past. */
    @Scheduled(fixedRateString = "${hms.room-block.auto-release-poll-ms:1800000}")
    public void run() {
        int n = roomManagementService.releaseExpiredAutoBlocks();
        if (n > 0) {
            log.info("Auto-released {} room block(s)", n);
        }
    }
}
