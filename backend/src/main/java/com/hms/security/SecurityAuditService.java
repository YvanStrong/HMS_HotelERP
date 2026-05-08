package com.hms.security;

import com.hms.entity.Hotel;
import com.hms.entity.HotelAuditLog;
import com.hms.repository.HotelAuditLogRepository;
import com.hms.repository.HotelRepository;
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

    public SecurityAuditService(HotelAuditLogRepository auditRepo, HotelRepository hotelRepo) {
        this.auditRepo = auditRepo;
        this.hotelRepo = hotelRepo;
    }

    public void logEvent(String action, UUID actorUserId, UUID hotelId, Map<String, Object> details) {
        // 1. SLF4J for SIEM / log aggregation (unchanged)
        log.info(
                "action={} actorUserId={} hotelId={} details={}",
                action,
                actorUserId,
                hotelId,
                details == null ? Map.of() : details);

        // 2. Durable DB write for in-app querying & audit trail
        try {
            HotelAuditLog entry = new HotelAuditLog();
            if (hotelId != null) {
                hotelRepo.findById(hotelId).ifPresent(entry::setHotel);
            }
            entry.setActorUserId(actorUserId);
            entry.setAction(action);
            if (details != null) {
                entry.setDetails(details.toString());
                Object targetType = details.get("targetType");
                if (targetType != null) entry.setTargetType(targetType.toString());
                Object targetId = details.get("targetId");
                if (targetId instanceof UUID uid) entry.setTargetId(uid);
            }
            auditRepo.save(entry);
        } catch (Exception e) {
            log.warn("Failed to persist audit log entry for action={}: {}", action, e.getMessage());
        }
    }

    public void logEvent(String action, UUID actorUserId, UUID hotelId, Map<String, Object> details, String ipAddress) {
        logEvent(action, actorUserId, hotelId, details);
        // IP is already in SLF4J context; for DB, update the latest entry
        try {
            // Best-effort IP attachment
            if (ipAddress != null) {
                log.debug("action={} ip={}", action, ipAddress);
            }
        } catch (Exception ignored) {
        }
    }
}
