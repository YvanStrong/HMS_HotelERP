package com.hms.events;

import com.hms.domain.RoomStatus;
import java.util.UUID;

public record RoomStatusChangedEvent(
        UUID hotelId, UUID roomId, RoomStatus previousStatus, RoomStatus newStatus, String broadcastMessage) {}
