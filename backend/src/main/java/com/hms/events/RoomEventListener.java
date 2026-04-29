package com.hms.events;

import com.hms.service.RoomWebSocketPublisher;
import java.util.Map;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class RoomEventListener {

    private final RoomWebSocketPublisher publisher;

    public RoomEventListener(RoomWebSocketPublisher publisher) {
        this.publisher = publisher;
    }

    @Async
    @EventListener
    public void onCheckedOut(RoomCheckedOutEvent event) {
        publisher.publishRoomUpdate(
                event.hotelId(),
                Map.of(
                        "type",
                        "ROOM_CHECKED_OUT",
                        "roomId",
                        event.roomId().toString(),
                        "reservationId",
                        event.reservationId().toString()));
    }

    @EventListener
    public void onRoomStatusChanged(RoomStatusChangedEvent event) {
        publisher.publishRoomUpdate(
                event.hotelId(),
                Map.of(
                        "type",
                        "ROOM_STATUS_CHANGED",
                        "roomId",
                        event.roomId().toString(),
                        "previousStatus",
                        event.previousStatus().name(),
                        "newStatus",
                        event.newStatus().name(),
                        "message",
                        event.broadcastMessage()));
    }
}
