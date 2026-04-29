package com.hms.events;

import java.util.UUID;

public record RoomCheckedOutEvent(UUID hotelId, UUID roomId, UUID reservationId) {}
