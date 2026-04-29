package com.hms.config;

import com.hms.websocket.StompTenantSecurityChannelInterceptor;
import com.hms.websocket.WebSocketJwtHandshakeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketJwtHandshakeInterceptor webSocketJwtHandshakeInterceptor;
    private final StompTenantSecurityChannelInterceptor stompTenantSecurityChannelInterceptor;

    public WebSocketConfig(
            WebSocketJwtHandshakeInterceptor webSocketJwtHandshakeInterceptor,
            StompTenantSecurityChannelInterceptor stompTenantSecurityChannelInterceptor) {
        this.webSocketJwtHandshakeInterceptor = webSocketJwtHandshakeInterceptor;
        this.stompTenantSecurityChannelInterceptor = stompTenantSecurityChannelInterceptor;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompTenantSecurityChannelInterceptor);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .addInterceptors(webSocketJwtHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
