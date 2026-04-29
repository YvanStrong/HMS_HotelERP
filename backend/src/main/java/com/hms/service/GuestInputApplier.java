package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.repository.GuestRepository;
import com.hms.web.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/** Maps {@link ApiDtos.GuestInput} onto {@link Guest} for create and staff merge flows. */
public final class GuestInputApplier {

    private GuestInputApplier() {}

    /** Populates a new guest row (caller must validate national_id uniqueness first). */
    public static void populateNewGuest(Hotel hotel, Guest guest, ApiDtos.GuestInput g) {
        guest.setHotel(hotel);
        String fn = g.firstName() != null ? g.firstName().trim() : "";
        String ln = g.lastName() != null ? g.lastName().trim() : "";
        if (fn.isEmpty() && g.fullName() != null && !g.fullName().isBlank()) {
            String[] parts = g.fullName().trim().split("\\s+", 2);
            fn = parts[0];
            ln = parts.length > 1 ? parts[1] : "Guest";
        }
        if (fn.isEmpty()) {
            fn = "Guest";
        }
        if (ln.isEmpty()) {
            ln = "Guest";
        }
        String fullName =
                g.fullName() != null && !g.fullName().isBlank() ? g.fullName().trim() : (fn + " " + ln).trim();
        guest.setFirstName(fn);
        guest.setLastName(ln);
        guest.setFullName(fullName);
        guest.setNationalId(g.nationalId().trim());
        guest.setDateOfBirth(g.dateOfBirth());
        guest.setNationality(g.nationality());
        guest.setGender(g.gender());
        guest.setEmail(g.email());
        guest.setPhone(g.phone());
        guest.setPhoneCountryCode(g.phoneCountryCode());
        guest.setCountry(g.country() != null && !g.country().isBlank() ? g.country().trim() : "Rwanda");
        guest.setProvince(g.province());
        guest.setDistrict(g.district());
        guest.setSector(g.sector());
        guest.setCell(g.cell());
        guest.setVillage(g.village());
        guest.setStreetNumber(g.streetNumber());
        guest.setAddressNotes(g.addressNotes());
        String idType = g.idType() != null && !g.idType().isBlank() ? g.idType().trim().toUpperCase() : "NATIONAL_ID";
        guest.setIdType(idType);
        guest.setIdExpiryDate(g.idExpiryDate());
        if (g.idDocument() != null) {
            guest.setIdDocumentType(
                    g.idDocument().type() != null ? g.idDocument().type() : idType);
            if (g.idDocument().number() != null && !g.idDocument().number().isBlank()) {
                guest.setIdDocumentNumber(g.idDocument().number().trim());
            }
        } else {
            guest.setIdDocumentType(idType);
        }
        if (guest.getIdDocumentNumber() == null || guest.getIdDocumentNumber().isBlank()) {
            guest.setIdDocumentNumber(guest.getNationalId());
        }
        guest.setVipLevel(g.vipLevel() != null && !g.vipLevel().isBlank() ? g.vipLevel() : "NONE");
        guest.setMarketingConsent(Boolean.TRUE.equals(g.marketingConsent()));
        guest.setNotes(g.notes());
        if (g.isBlacklisted() != null) {
            guest.setBlacklisted(Boolean.TRUE.equals(g.isBlacklisted()));
        }
        if (g.blacklistReason() != null) {
            guest.setBlacklistReason(g.blacklistReason().isBlank() ? null : g.blacklistReason().trim());
        }
        GuestProfileDefaults.ensureRequiredForPersistence(guest);
    }

    /** Overwrites fields from staff edit before booking; validates national_id uniqueness when changed. */
    public static void mergeGuestFromInput(UUID hotelId, Guest guest, ApiDtos.GuestInput g, GuestRepository guestRepository) {
        if (g.nationalId() != null && !g.nationalId().isBlank()) {
            String next = g.nationalId().trim();
            if (!next.equalsIgnoreCase(guest.getNationalId())) {
                guestRepository
                        .findByHotel_IdAndNationalIdIgnoreCase(hotelId, next)
                        .filter(other -> !other.getId().equals(guest.getId()))
                        .ifPresent(
                                x -> {
                                    throw new ApiException(
                                            HttpStatus.CONFLICT,
                                            "GUEST_NATIONAL_ID_EXISTS",
                                            "Another guest already uses this national ID");
                                });
                guest.setNationalId(next);
            }
        }
        if (g.dateOfBirth() != null) {
            guest.setDateOfBirth(g.dateOfBirth());
        }
        if (g.firstName() != null && !g.firstName().isBlank()) {
            guest.setFirstName(g.firstName().trim());
        }
        if (g.lastName() != null && !g.lastName().isBlank()) {
            guest.setLastName(g.lastName().trim());
        }
        if (g.fullName() != null && !g.fullName().isBlank()) {
            guest.setFullName(g.fullName().trim());
        } else if (g.firstName() != null || g.lastName() != null) {
            guest.setFullName((guest.getFirstName() + " " + guest.getLastName()).trim());
        }
        if (g.nationality() != null) {
            guest.setNationality(g.nationality().isBlank() ? null : g.nationality().trim());
        }
        if (g.gender() != null) {
            guest.setGender(g.gender().isBlank() ? null : g.gender().trim());
        }
        if (g.email() != null) {
            guest.setEmail(g.email().isBlank() ? null : g.email().trim());
        }
        if (g.phone() != null) {
            guest.setPhone(g.phone().isBlank() ? null : g.phone().trim());
        }
        if (g.phoneCountryCode() != null) {
            guest.setPhoneCountryCode(
                    g.phoneCountryCode().isBlank() ? null : g.phoneCountryCode().trim());
        }
        if (g.country() != null && !g.country().isBlank()) {
            guest.setCountry(g.country().trim());
        }
        if (g.province() != null) {
            guest.setProvince(g.province().isBlank() ? null : g.province().trim());
        }
        if (g.district() != null) {
            guest.setDistrict(g.district().isBlank() ? null : g.district().trim());
        }
        if (g.sector() != null) {
            guest.setSector(g.sector().isBlank() ? null : g.sector().trim());
        }
        if (g.cell() != null) {
            guest.setCell(g.cell().isBlank() ? null : g.cell().trim());
        }
        if (g.village() != null) {
            guest.setVillage(g.village().isBlank() ? null : g.village().trim());
        }
        if (g.streetNumber() != null) {
            guest.setStreetNumber(g.streetNumber().isBlank() ? null : g.streetNumber().trim());
        }
        if (g.addressNotes() != null) {
            guest.setAddressNotes(g.addressNotes().isBlank() ? null : g.addressNotes().trim());
        }
        if (g.idType() != null && !g.idType().isBlank()) {
            guest.setIdType(g.idType().trim().toUpperCase());
        }
        if (g.idExpiryDate() != null) {
            guest.setIdExpiryDate(g.idExpiryDate());
        }
        if (g.idDocument() != null) {
            if (g.idDocument().type() != null && !g.idDocument().type().isBlank()) {
                guest.setIdDocumentType(g.idDocument().type().trim());
            }
            if (g.idDocument().number() != null && !g.idDocument().number().isBlank()) {
                guest.setIdDocumentNumber(g.idDocument().number().trim());
            }
        }
        if (guest.getIdDocumentNumber() == null || guest.getIdDocumentNumber().isBlank()) {
            guest.setIdDocumentNumber(guest.getNationalId());
        }
        if (g.vipLevel() != null && !g.vipLevel().isBlank()) {
            guest.setVipLevel(g.vipLevel().trim());
        }
        if (g.marketingConsent() != null) {
            guest.setMarketingConsent(Boolean.TRUE.equals(g.marketingConsent()));
        }
        if (g.notes() != null) {
            guest.setNotes(g.notes().isBlank() ? null : g.notes().trim());
        }
        if (g.isBlacklisted() != null) {
            guest.setBlacklisted(Boolean.TRUE.equals(g.isBlacklisted()));
        }
        if (g.blacklistReason() != null) {
            guest.setBlacklistReason(g.blacklistReason().isBlank() ? null : g.blacklistReason().trim());
        }
        GuestProfileDefaults.ensureRequiredForPersistence(guest);
    }
}
