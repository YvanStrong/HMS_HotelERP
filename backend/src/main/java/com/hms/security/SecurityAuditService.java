package com.hms.security;

import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SecurityAuditService {

    private static final Logger log = LoggerFactory.getLogger("SECURITY_AUDIT");

    public void logEvent(String action, UUID actorUserId, UUID hotelId, Map<String, Object> details) {
        log.info(
                "action={} actorUserId={} hotelId={} details={}",
                action,
                actorUserId,
                hotelId,
                details == null ? Map.of() : details);
    }
}
