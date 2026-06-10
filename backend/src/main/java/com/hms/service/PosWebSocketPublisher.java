package com.hms.service;

import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class PosWebSocketPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public PosWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishPosOrder(UUID hotelId, Object payload) {
        messagingTemplate.convertAndSend("/topic/hotel/" + hotelId + "/pos-orders", payload);
    }

    public void publishKitchen(UUID hotelId, Object payload) {
        messagingTemplate.convertAndSend("/topic/hotel/" + hotelId + "/pos/kitchen", payload);
    }

    public void publishTables(UUID hotelId, Object payload) {
        messagingTemplate.convertAndSend("/topic/hotel/" + hotelId + "/pos/tables", payload);
    }

    public void publishLineReady(UUID hotelId, Object payload) {
        messagingTemplate.convertAndSend("/topic/hotel/" + hotelId + "/pos/line-ready", payload);
    }
}
