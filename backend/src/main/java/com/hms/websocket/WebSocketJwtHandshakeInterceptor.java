package com.hms.websocket;

import java.util.Map;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Component
public class WebSocketJwtHandshakeInterceptor implements HandshakeInterceptor {

    public static final String SESSION_JWT = "jwtToken";
    public static final String SESSION_IMPERSONATE = "impersonateToken";

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servlet) {
            String token = servlet.getServletRequest().getParameter("token");
            if (token != null && !token.isBlank()) {
                attributes.put(SESSION_JWT, token.trim());
            }
            String imp = servlet.getServletRequest().getParameter("impersonateToken");
            if (imp != null && !imp.isBlank()) {
                attributes.put(SESSION_IMPERSONATE, imp.trim());
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception ex) {
        // no-op
    }
}
