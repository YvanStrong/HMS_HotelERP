package com.hms.service;

import java.util.Map;
import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class FacilityWebSocketPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public FacilityWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishOccupancy(UUID hotelId, UUID facilityId, int occupancy, int capacity) {
        messagingTemplate.convertAndSend(
                "/topic/hotel/" + hotelId + "/facilities",
                Map.of(
                        "event",
                        "facility.occupancy.updated",
                        "facilityId",
                        facilityId.toString(),
                        "occupancy",
                        occupancy,
                        "capacity",
                        capacity));
    }

    public void publishFolioCharge(UUID reservationId, Object payload) {
        messagingTemplate.convertAndSend("/topic/reservations/" + reservationId + "/folio", payload);
    }
}
