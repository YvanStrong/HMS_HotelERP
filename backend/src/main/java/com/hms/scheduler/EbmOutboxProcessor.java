package com.hms.scheduler;

import com.hms.config.HmsEbmProperties;
import com.hms.entity.EbmDevice;
import com.hms.repository.EbmDeviceRepository;
import com.hms.service.EbmOutboxService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EbmOutboxProcessor {

    private static final Logger log = LoggerFactory.getLogger(EbmOutboxProcessor.class);

    private final HmsEbmProperties properties;
    private final EbmDeviceRepository deviceRepository;
    private final EbmOutboxService outboxService;

    public EbmOutboxProcessor(
            HmsEbmProperties properties, EbmDeviceRepository deviceRepository, EbmOutboxService outboxService) {
        this.properties = properties;
        this.deviceRepository = deviceRepository;
        this.outboxService = outboxService;
    }

    @Scheduled(fixedDelayString = "${hms.ebm.outbox-poll-ms:15000}")
    public void poll() {
        if (!properties.isEnabled()) {
            return;
        }
        for (EbmDevice device : deviceRepository.findByStatus("ACTIVE")) {
            try {
                outboxService.processDevice(device.getId());
            } catch (Exception ex) {
                log.warn("EBM outbox poll failed for device {}: {}", device.getId(), ex.getMessage());
            }
        }
    }
}
