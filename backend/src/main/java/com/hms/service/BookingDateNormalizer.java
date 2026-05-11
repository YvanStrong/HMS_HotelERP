package com.hms.service;

import java.time.LocalDate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Converts API check-out into the exclusive end date stored on {@link com.hms.entity.Reservation} (first morning
 * <em>not</em> part of the stay). When {@code hms.booking.check-out-last-night-inclusive} is true, the client sends the
 * <strong>last calendar night</strong> of the stay (inclusive); we add one day so overlap logic matches front-desk
 * wording ("stay 3rd–10th" → room free from the 11th).
 */
@Component
public class BookingDateNormalizer {

    private final boolean checkOutLastNightInclusive;

    public BookingDateNormalizer(
            @Value("${hms.booking.check-out-last-night-inclusive:false}") boolean checkOutLastNightInclusive) {
        this.checkOutLastNightInclusive = checkOutLastNightInclusive;
    }

    /**
     * @param checkIn first night of stay (inclusive)
     * @param checkOutFromClient either exclusive departure morning (default) or last night inclusive when flag is
     *     on
     * @return exclusive check-out morning date to persist and use in overlap queries
     */
    public LocalDate toStorageCheckOutExclusive(LocalDate checkIn, LocalDate checkOutFromClient) {
        if (checkOutFromClient.isBefore(checkIn)) {
            return checkOutFromClient;
        }
        if (!checkOutLastNightInclusive) {
            return checkOutFromClient;
        }
        return checkOutFromClient.plusDays(1);
    }
}
