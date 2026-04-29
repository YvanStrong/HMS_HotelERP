package com.hms.service;

import com.hms.entity.Guest;
import java.time.LocalDate;
import java.util.UUID;

/** Ensures DB NOT NULL / unique constraints for legacy and minimal guest creation paths. */
public final class GuestProfileDefaults {

    private GuestProfileDefaults() {}

    public static void ensureRequiredForPersistence(Guest g) {
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
            g.setCountry("Rwanda");
        }
        if (g.getIdType() == null || g.getIdType().isBlank()) {
            g.setIdType("NATIONAL_ID");
        }
        if (g.getVipLevel() == null || g.getVipLevel().isBlank()) {
            g.setVipLevel("NONE");
        }
        if (g.getIdDocumentType() == null || g.getIdDocumentType().isBlank()) {
            g.setIdDocumentType(g.getIdType());
        }
    }
}
