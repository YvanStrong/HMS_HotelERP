package com.hms.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Simple in-memory sliding-window limits for anonymous public self-order APIs (per client IP + route class). Not
 * suitable for multi-instance clusters without a shared store — upgrade to Redis / gateway limits for that.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class SelfOrderPublicRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000L;

    private static final class Window {
        volatile long startMs = System.currentTimeMillis();
        final AtomicInteger count = new AtomicInteger(0);
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri == null || !uri.startsWith("/api/v1/public/hotels/") || !uri.contains("/self-order");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String ip = clientIp(request);
        String uri = request.getRequestURI();
        String method = request.getMethod();
        String route = routeClass(uri, method);
        int max = maxFor(route, method);
        String key = ip + "|" + route;
        long now = System.currentTimeMillis();
        Window w = windows.computeIfAbsent(key, k -> new Window());
        synchronized (w) {
            if (now - w.startMs > WINDOW_MS) {
                w.startMs = now;
                w.count.set(0);
            }
            if (w.count.incrementAndGet() > max) {
                response.setStatus(429);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"RATE_LIMIT\",\"message\":\"Too many requests. Try again shortly.\"}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private static String routeClass(String uri, String method) {
        if (uri.endsWith("/self-order") && "POST".equalsIgnoreCase(method)) {
            return "place";
        }
        if (uri.contains("/push-subscribe") && "POST".equalsIgnoreCase(method)) {
            return "push_sub";
        }
        if (uri.contains("/track") && "GET".equalsIgnoreCase(method)) {
            return "track";
        }
        if ((uri.contains("/board") || uri.contains("/pickup-board")) && "GET".equalsIgnoreCase(method)) {
            return "board";
        }
        return "other";
    }

    private static int maxFor(String route, String method) {
        return switch (route) {
            case "place" -> 20;
            case "push_sub" -> 15;
            case "track" -> 120;
            case "board" -> 90;
            default -> 200;
        };
    }

    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            String first = comma > 0 ? xff.substring(0, comma) : xff;
            return first.trim();
        }
        return req.getRemoteAddr() == null ? "unknown" : req.getRemoteAddr();
    }
}
