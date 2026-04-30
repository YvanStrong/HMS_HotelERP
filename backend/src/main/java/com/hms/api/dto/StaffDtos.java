package com.hms.api.dto;

import jakarta.validation.constraints.NotBlank;

public final class StaffDtos {

    private StaffDtos() {}

    public record CreateHotelStaffUserRequest(
            @NotBlank String username,
            @NotBlank String password,
            String email,
            String role) {}

    public record StaffUserResponse(
            String id,
            String username,
            String email,
            String role,
            String hotelId) {}
}
