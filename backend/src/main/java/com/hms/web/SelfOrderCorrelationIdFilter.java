package com.hms.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Propagates {@code X-Correlation-ID} (or generates one) into SLF4J {@link MDC} for public self-order traffic so logs
 * and {@code self_order_events.correlation_id} line up with browser / mobile clients.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SelfOrderCorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-ID";
    public static final String MDC_KEY = "correlationId";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri == null || !uri.startsWith("/api/v1/public/hotels/") || !uri.contains("/self-order");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HEADER);
        String cid =
                incoming != null && !incoming.isBlank() ? incoming.trim().substring(0, Math.min(80, incoming.trim().length()))
                        : UUID.randomUUID().toString();
        MDC.put(MDC_KEY, cid);
        response.setHeader(HEADER, cid);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
