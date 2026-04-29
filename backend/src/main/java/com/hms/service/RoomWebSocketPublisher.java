package com.hms.service;

import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class RoomWebSocketPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public RoomWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishRoomUpdate(UUID hotelId, Object payload) {
        messagingTemplate.convertAndSend("/topic/hotel/" + hotelId + "/rooms", payload);
    }
}
