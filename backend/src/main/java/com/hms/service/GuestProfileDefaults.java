package com.hms.service;

import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import java.time.LocalDate;
import java.util.UUID;

/** Ensures DB NOT NULL / unique constraints for legacy and minimal guest creation paths. */
public final class GuestProfileDefaults {

    private static final String FALLBACK_COUNTRY = "UNKNOWN";
    private static final String FALLBACK_ID_TYPE = "NATIONAL_ID";

    private GuestProfileDefaults() {}

    public static void ensureRequiredForPersistence(Guest g, Hotel hotel) {
        if (g.getFirstName() == null || g.getFirstName().isBlank()) {
            g.setFirstName("Guest");
        }
        if (g.getLastName() == null || g.getLastName().isBlank()) {
            g.setLastName("Guest");
        }
        if (g.getFullName() == null || g.getFullName().isBlank()) {
            g.setFullName((g.getFirstName() + " " + g.getLastName()).trim());
        }
        if (g.getNationalId() == null || g.getNationalId().isBlank()) {
            g.setNationalId("TEMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        }
        if (g.getDateOfBirth() == null) {
            g.setDateOfBirth(LocalDate.of(1990, 1, 1));
        }
        if (g.getIdDocumentNumber() == null || g.getIdDocumentNumber().isBlank()) {
            g.setIdDocumentNumber(g.getNationalId());
        }
        if (g.getCountry() == null || g.getCountry().isBlank()) {
            g.setCountry(resolveDefaultCountry(hotel));
        }
        if (g.getIdType() == null || g.getIdType().isBlank()) {
            g.setIdType(resolveDefaultIdType(hotel));
        }
        if ((g.getPhoneCountryCode() == null || g.getPhoneCountryCode().isBlank()) && hotel != null) {
            g.setPhoneCountryCode(hotel.getPhoneCountryCode());
        }
        if (g.getVipLevel() == null || g.getVipLevel().isBlank()) {
            g.setVipLevel("NONE");
        }
        if (g.getIdDocumentType() == null || g.getIdDocumentType().isBlank()) {
            g.setIdDocumentType(g.getIdType());
        }
    }

    private static String resolveDefaultCountry(Hotel hotel) {
        if (hotel != null && hotel.getDefaultCountry() != null && !hotel.getDefaultCountry().isBlank()) {
            return hotel.getDefaultCountry().trim();
        }
        return FALLBACK_COUNTRY;
    }

    private static String resolveDefaultIdType(Hotel hotel) {
        if (hotel != null && hotel.getDefaultIdType() != null && !hotel.getDefaultIdType().isBlank()) {
            return hotel.getDefaultIdType().trim().toUpperCase();
        }
        return FALLBACK_ID_TYPE;
    }
}
