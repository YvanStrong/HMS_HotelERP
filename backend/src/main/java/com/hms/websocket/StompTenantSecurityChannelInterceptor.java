package com.hms.websocket;

import com.hms.domain.Role;
import com.hms.repository.ReservationRepository;
import com.hms.security.JwtAuthenticationFilter;
import com.hms.security.JwtService;
import com.hms.security.JwtWebAuthSupport;
import com.hms.security.UserPrincipal;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class StompTenantSecurityChannelInterceptor implements ChannelInterceptor {

    private static final Pattern HOTEL_TOPIC = Pattern.compile("^/topic/hotel/([0-9a-fA-F-]{36})/(rooms|facilities)$");
    private static final Pattern RES_FOLIO_TOPIC = Pattern.compile("^/topic/reservations/([0-9a-fA-F-]{36})/folio$");

    private final JwtService jwtService;
    private final ReservationRepository reservationRepository;

    public StompTenantSecurityChannelInterceptor(JwtService jwtService, ReservationRepository reservationRepository) {
        this.jwtService = jwtService;
        this.reservationRepository = reservationRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }
        StompCommand cmd = accessor.getCommand();
        if (cmd == null) {
            return message;
        }
        if (StompCommand.CONNECT.equals(cmd)) {
            UserPrincipal user = resolveUser(accessor);
            if (user == null) {
                throw new AccessDeniedException("Unauthorized STOMP CONNECT: missing or invalid token");
            }
            accessor.setUser(user);
            return message;
        }
        if (StompCommand.SUBSCRIBE.equals(cmd)) {
            Principal p = accessor.getUser();
            if (!(p instanceof UserPrincipal user)) {
                throw new AccessDeniedException("Unauthorized SUBSCRIBE");
            }
            String dest = accessor.getDestination();
            if (dest == null) {
                throw new AccessDeniedException("SUBSCRIBE missing destination");
            }
            assertTopicAllowed(dest, user);
        }
        return message;
    }

    private UserPrincipal resolveUser(StompHeaderAccessor accessor) {
        List<String> authHeaders = accessor.getNativeHeader(HttpHeaders.AUTHORIZATION);
        String bearer = authHeaders != null && !authHeaders.isEmpty() ? authHeaders.get(0) : null;
        if (bearer == null || bearer.isBlank()) {
            Map<String, Object> sess = accessor.getSessionAttributes();
            if (sess != null) {
                Object t = sess.get(WebSocketJwtHandshakeInterceptor.SESSION_JWT);
                if (t instanceof String s && !s.isBlank()) {
                    bearer = s.startsWith("Bearer ") ? s : "Bearer " + s;
                }
            }
        }
        List<String> impHeaders = accessor.getNativeHeader(JwtAuthenticationFilter.IMPERSONATE_HEADER);
        String imp = impHeaders != null && !impHeaders.isEmpty() ? impHeaders.get(0) : null;
        if (imp == null || imp.isBlank()) {
            Map<String, Object> sess = accessor.getSessionAttributes();
            if (sess != null) {
                Object t = sess.get(WebSocketJwtHandshakeInterceptor.SESSION_IMPERSONATE);
                if (t instanceof String s && !s.isBlank()) {
                    imp = s;
                }
            }
        }
        return JwtWebAuthSupport.resolvePrincipal(jwtService, bearer, imp);
    }

    private void assertTopicAllowed(String destination, UserPrincipal user) {
        if (user.getRole() == Role.SUPER_ADMIN) {
            return;
        }
        Matcher m1 = HOTEL_TOPIC.matcher(destination);
        if (m1.matches()) {
            UUID hotelTopic = UUID.fromString(m1.group(1));
            if (user.getHotelId() != null && user.getHotelId().equals(hotelTopic)) {
                return;
            }
            throw new AccessDeniedException("Forbidden topic for tenant");
        }
        Matcher m2 = RES_FOLIO_TOPIC.matcher(destination);
        if (m2.matches()) {
            UUID resId = UUID.fromString(m2.group(1));
            if (user.getHotelId() == null) {
                throw new AccessDeniedException("Forbidden folio topic");
            }
            UUID resHotel =
                    reservationRepository.findHotelIdById(resId).orElseThrow(() -> new AccessDeniedException("Unknown reservation"));
            if (user.getHotelId().equals(resHotel)) {
                return;
            }
            throw new AccessDeniedException("Forbidden folio topic");
        }
        throw new AccessDeniedException("Unknown or disallowed topic: " + destination);
    }
}
