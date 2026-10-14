package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.web.ApiException;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;

/** Shared mandatory-field checks for guest create / public book / reservation guest payload. */
public final class GuestInputValidator {

    private GuestInputValidator() {}

    public static void requireNewGuestFields(ApiDtos.GuestInput input) {
        if (input == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "guest details are required");
        }
        String fullName = input.fullName() != null ? input.fullName().trim() : "";
        String first = input.firstName() != null ? input.firstName().trim() : "";
        String last = input.lastName() != null ? input.lastName().trim() : "";
        if (fullName.isEmpty() && (first.isEmpty() || last.isEmpty())) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "full_name is required (or both firstName and lastName)");
        }
        if (input.nationalId() == null || input.nationalId().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "national_id is required");
        }
        if (input.dateOfBirth() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "date_of_birth is required");
        }
        if (input.dateOfBirth().isAfter(LocalDate.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "date_of_birth cannot be in the future");
        }
        if (input.country() == null || input.country().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "country is required");
        }
        String idType = input.idType() != null ? input.idType().trim().toUpperCase() : "NATIONAL_ID";
        if (!"NATIONAL_ID".equals(idType)) {
            boolean hasDoc =
                    input.idDocument() != null
                            && input.idDocument().number() != null
                            && !input.idDocument().number().isBlank();
            if (!hasDoc) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST, "id document number is required for the selected id_type");
            }
        }
    }
}
