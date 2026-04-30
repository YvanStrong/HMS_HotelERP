package com.hms.service;

import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.web.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformStaffUserService {

    private static final int MIN_PASSWORD_LEN = 8;

    private final AppUserRepository appUserRepository;
    private final HotelRepository hotelRepository;
    private final PasswordEncoder passwordEncoder;

    public PlatformStaffUserService(
            AppUserRepository appUserRepository, HotelRepository hotelRepository, PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.hotelRepository = hotelRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void createHotelScopedUser(UUID hotelId, String username, String password, String email, String roleRaw) {
        createHotelScopedUserReturning(hotelId, username, password, email, roleRaw);
    }

    @Transactional
    public AppUser createHotelScopedUserReturning(
            UUID hotelId, String username, String password, String email, String roleRaw) {
        if (username == null || username.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Username is required");
        }
        if (password == null || password.length() < MIN_PASSWORD_LEN) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Password must be at least " + MIN_PASSWORD_LEN + " characters");
        }
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        String u = username.trim();
        if (appUserRepository.findByUsername(u).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "Username already exists: " + u);
        }
        String em = email == null || email.isBlank() ? null : email.trim();
        if (em != null && appUserRepository.findByEmailIgnoreCase(em).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "Email already exists: " + em);
        }
        AppUser user = new AppUser();
        user.setUsername(u);
        user.setEmail(em);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(parseRole(roleRaw));
        user.setHotel(hotel);
        return appUserRepository.save(user);
    }

    private static Role parseRole(String roleRaw) {
        if (roleRaw == null || roleRaw.isBlank()) {
            return Role.HOTEL_ADMIN;
        }
        String r = roleRaw.trim().toUpperCase();
        return switch (r) {
            case "HOTEL_ADMIN", "HOTEL_STAFF", "ADMIN" -> Role.HOTEL_ADMIN;
            case "MANAGER" -> Role.MANAGER;
            case "RECEPTIONIST" -> Role.RECEPTIONIST;
            case "HOUSEKEEPING" -> Role.HOUSEKEEPING;
            case "HOUSEKEEPING_SUPERVISOR" -> Role.HOUSEKEEPING_SUPERVISOR;
            case "MAINTENANCE" -> Role.MAINTENANCE;
            case "FNB_STAFF", "F&B_STAFF" -> Role.FNB_STAFF;
            case "FINANCE" -> Role.FINANCE;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported role: " + roleRaw);
        };
    }
}
