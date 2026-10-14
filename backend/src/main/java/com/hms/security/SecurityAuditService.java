package com.hms.security;

import com.hms.entity.HotelAuditLog;
import com.hms.repository.HotelAuditLogRepository;
import com.hms.repository.HotelRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Dual-write security audit: DB (durable, queryable) + SLF4J (SIEM-ready).
 */
@Service
public class SecurityAuditService {

    private static final Logger log = LoggerFactory.getLogger("SECURITY_AUDIT");

    private final HotelAuditLogRepository auditRepo;
    private final HotelRepository hotelRepo;
    private final ObjectMapper objectMapper;

    public SecurityAuditService(
            HotelAuditLogRepository auditRepo, HotelRepository hotelRepo, ObjectMapper objectMapper) {
        this.auditRepo = auditRepo;
        this.hotelRepo = hotelRepo;
        this.objectMapper = objectMapper;
    }

    public void logEvent(String action, UUID actorUserId, UUID hotelId, Map<String, Object> details) {
        logEvent(action, actorUserId, hotelId, details, null, null);
    }

    public void logEvent(String action, UUID actorUserId, UUID hotelId, Map<String, Object> details, String ipAddress) {
        logEvent(action, actorUserId, hotelId, details, ipAddress, null);
    }

    public void logEvent(
            String action,
            UUID actorUserId,
            UUID hotelId,
            Map<String, Object> details,
            String ipAddress,
            String actorUsername) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (details != null) {
            payload.putAll(details);
        }
        if (actorUsername != null && !actorUsername.isBlank()) {
            payload.putIfAbsent("username", actorUsername.trim());
        }
        log.info(
                "action={} actorUserId={} actor={} hotelId={} ip={} details={}",
                action,
                actorUserId,
                actorUsername,
                hotelId,
                ipAddress,
                payload);

        try {
            HotelAuditLog entry = new HotelAuditLog();
            if (hotelId != null) {
                hotelRepo.findById(hotelId).ifPresent(entry::setHotel);
            }
            entry.setActorUserId(actorUserId);
            entry.setAction(trimTo(action != null ? action : "UNKNOWN", 100));
            entry.setIpAddress(trimTo(ipAddress, 45));
            Object targetType = payload.get("targetType");
            if (targetType != null) {
                entry.setTargetType(trimTo(String.valueOf(targetType), 50));
            }
            Object targetId = payload.get("targetId");
            if (targetId instanceof UUID uid) {
                entry.setTargetId(uid);
            } else if (targetId != null) {
                try {
                    entry.setTargetId(UUID.fromString(String.valueOf(targetId)));
                } catch (Exception ignored) {
                    // keep in details
                }
            }
            entry.setDetails(writeDetails(payload));
            auditRepo.save(entry);
        } catch (Exception e) {
            log.warn("Failed to persist audit log entry for action={}: {}", action, e.getMessage());
        }
    }

    private String writeDetails(Map<String, Object> details) {
        try {
            return objectMapper.writeValueAsString(details);
        } catch (Exception e) {
            return String.valueOf(details);
        }
    }

    private static String trimTo(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String t = value.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }
}
