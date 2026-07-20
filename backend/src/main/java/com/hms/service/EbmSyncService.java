package com.hms.service;

import com.hms.config.HmsEbmProperties;
import com.hms.ebm.EbmClient;
import com.hms.entity.EbmDevice;
import com.hms.entity.EbmSyncCursor;
import com.hms.repository.EbmDeviceRepository;
import com.hms.repository.EbmSyncCursorRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EbmSyncService {

    private static final Logger log = LoggerFactory.getLogger(EbmSyncService.class);
    private static final List<String> CATEGORIES = List.of("CODE_LIST", "ITEM_CLASS", "CUSTOMER", "NOTICES");

    private final HmsEbmProperties properties;
    private final EbmDeviceRepository deviceRepository;
    private final EbmSyncCursorRepository cursorRepository;
    private final EbmClient ebmClient;

    public EbmSyncService(
            HmsEbmProperties properties,
            EbmDeviceRepository deviceRepository,
            EbmSyncCursorRepository cursorRepository,
            EbmClient ebmClient) {
        this.properties = properties;
        this.deviceRepository = deviceRepository;
        this.cursorRepository = cursorRepository;
        this.ebmClient = ebmClient;
    }

    public void syncAllActiveDevices() {
        for (EbmDevice device : deviceRepository.findByStatus("ACTIVE")) {
            for (String category : CATEGORIES) {
                try {
                    syncCategory(device.getId(), category);
                } catch (Exception ex) {
                    log.warn("EBM sync {} failed for device {}: {}", category, device.getId(), ex.getMessage());
                }
            }
            checkOfflineWindow(device);
        }
    }

    @Transactional
    public void syncCategory(UUID deviceId, String category) {
        EbmDevice device = deviceRepository.findById(deviceId).orElse(null);
        if (device == null || !device.isActive()) {
            return;
        }
        EbmSyncCursor cursor = cursorRepository
                .findByDeviceIdAndCategory(deviceId, category)
                .orElseGet(() -> {
                    EbmSyncCursor c = new EbmSyncCursor();
                    c.setDeviceId(deviceId);
                    c.setCategory(category);
                    return c;
                });
        Map<String, Object> response = ebmClient.pullCodeList(device, category, cursor.getLastReqDt());
        Instant next = extractCursor(response);
        cursor.setLastReqDt(next != null ? next : Instant.now());
        cursorRepository.save(cursor);
    }

    private void checkOfflineWindow(EbmDevice device) {
        if (device.getLastSignatureAt() == null) {
            return;
        }
        long hours = Duration.between(device.getLastSignatureAt(), Instant.now()).toHours();
        if (hours >= properties.getOfflineAlertHours()) {
            log.error(
                    "EBM CRITICAL: device {} last signature {}h ago — VSDC may stop issuing receipts at 24h",
                    device.getId(),
                    hours);
        } else if (hours >= properties.getOfflineWarnHours()) {
            log.warn(
                    "EBM WARN: device {} last signature {}h ago — restore connectivity before 24h cutoff",
                    device.getId(),
                    hours);
        }
    }

    private static Instant extractCursor(Map<String, Object> response) {
        Object data = response.get("data");
        Object raw = null;
        if (data instanceof Map<?, ?> nested) {
            raw = nested.get("resultDt");
            if (raw == null) {
                raw = nested.get("currentDate");
            }
        }
        if (raw == null) {
            raw = response.get("resultDt");
        }
        if (raw == null) {
            raw = response.get("currentDate");
        }
        if (raw == null) {
            return null;
        }
        try {
            return Instant.parse(String.valueOf(raw));
        } catch (Exception ignored) {
            return Instant.now();
        }
    }
}
