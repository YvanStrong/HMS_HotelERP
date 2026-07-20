package com.hms.scheduler;

import com.hms.config.HmsEbmProperties;
import com.hms.service.EbmSyncService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EbmSyncJob {

    private final HmsEbmProperties properties;
    private final EbmSyncService syncService;

    public EbmSyncJob(HmsEbmProperties properties, EbmSyncService syncService) {
        this.properties = properties;
        this.syncService = syncService;
    }

    @Scheduled(fixedDelayString = "${hms.ebm.sync-poll-ms:300000}")
    public void syncAll() {
        if (!properties.isEnabled()) {
            return;
        }
        syncService.syncAllActiveDevices();
    }
}
