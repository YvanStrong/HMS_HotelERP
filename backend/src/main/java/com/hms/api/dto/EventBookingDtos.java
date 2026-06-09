package com.hms.api.dto;

import com.hms.domain.EventBookingStatus;
import com.hms.domain.EventBookingType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDateTime;
import java.util.UUID;

public final class EventBookingDtos {

    private EventBookingDtos() {}

    public record EventBookingRequest(
            @NotBlank String eventName,
            EventBookingType eventType,
            EventBookingStatus status,
            @NotNull LocalDateTime startDatetime,
            @NotNull LocalDateTime endDatetime,
            String setupStyle,
            @PositiveOrZero Integer expectedPax,
            @PositiveOrZero Integer guaranteedPax,
            UUID venueOrFacilityId,
            String coordinatorNotes) {}

    public record EventBookingResponse(
            UUID id,
            UUID hotelId,
            UUID groupId,
            String eventName,
            EventBookingType eventType,
            EventBookingStatus status,
            LocalDateTime startDatetime,
            LocalDateTime endDatetime,
            String setupStyle,
            Integer expectedPax,
            Integer guaranteedPax,
            UUID venueOrFacilityId,
            String venueName,
            String coordinatorNotes) {}

    public record EventConflictResponse(boolean conflict, String message) {}
}
