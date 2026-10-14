package com.hms.security;

import com.hms.context.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Records every mutating hotel API call (create / update / delete) into hotel_audit_logs
 * so the Audit Logs screen is an operational trail, not only login events.
 */
@Component
public class ActivityAuditInterceptor implements HandlerInterceptor {

    private static final Pattern HOTEL_URI = Pattern.compile(
            "/api/v1/hotels/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(/.*)?");

    private static final Set<String> MUTATING = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final SecurityAuditService auditService;

    public ActivityAuditInterceptor(SecurityAuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        String method = request.getMethod() == null ? "" : request.getMethod().toUpperCase(Locale.ROOT);
        if (!MUTATING.contains(method)) {
            return;
        }
        String uri = request.getRequestURI() == null ? "" : request.getRequestURI();
        if (shouldSkip(uri)) {
            return;
        }

        Matcher m = HOTEL_URI.matcher(uri);
        UUID hotelId = null;
        String resource = uri;
        if (m.find()) {
            try {
                hotelId = UUID.fromString(m.group(1));
            } catch (IllegalArgumentException ignored) {
                hotelId = null;
            }
            resource = m.group(2) != null ? m.group(2) : "/";
        }
        if (hotelId == null) {
            hotelId = TenantContext.getTenantId();
        }
        if (hotelId == null) {
            return;
        }

        UserPrincipal user = currentUser();
        UUID actorId = user != null ? user.getId() : null;
        String username = user != null ? user.getUsername() : null;
        String verb = switch (method) {
            case "POST" -> "CREATE";
            case "PUT", "PATCH" -> "UPDATE";
            case "DELETE" -> "DELETE";
            default -> method;
        };
        String action = verb + "_" + resourceLabel(resource);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("method", method);
        details.put("path", uri);
        details.put("status", response.getStatus());
        details.put("targetType", resourceLabel(resource).replace('_', ' '));
        if (username != null) {
            details.put("username", username);
        }
        if (ex != null) {
            details.put("error", ex.getClass().getSimpleName());
        }
        String query = request.getQueryString();
        if (query != null && !query.isBlank() && query.length() < 400) {
            details.put("query", query);
        }

        auditService.logEvent(action, actorId, hotelId, details, clientIp(request), username);
    }

    private static boolean shouldSkip(String uri) {
        String u = uri.toLowerCase(Locale.ROOT);
        return u.contains("/audit-logs")
                || u.contains("/actuator")
                || u.contains("/swagger")
                || u.contains("/v3/api-docs")
                || u.contains("/ws/")
                || u.endsWith("/error")
                || u.contains("/ebm/outbox")
                || u.contains("/ebm/sync");
    }

    private static String resourceLabel(String resource) {
        if (resource == null || resource.isBlank() || "/".equals(resource)) {
            return "HOTEL";
        }
        String cleaned = resource.replaceAll("/[0-9a-fA-F-]{36}", "");
        cleaned = cleaned.replaceAll("^/+", "").replaceAll("/+$", "");
        if (cleaned.isBlank()) {
            return "HOTEL";
        }
        String[] parts = cleaned.split("/");
        int n = parts.length;
        String a = n >= 2 ? parts[n - 2] + "_" + parts[n - 1] : parts[n - 1];
        String label = a.replaceAll("[^A-Za-z0-9_]+", "_").toUpperCase(Locale.ROOT);
        if (label.length() > 120) {
            label = label.substring(0, 120);
        }
        return label;
    }

    private static UserPrincipal currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p;
        }
        return null;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return comma > 0 ? forwarded.substring(0, comma).trim() : forwarded.trim();
        }
        return request.getRemoteAddr();
    }
}
