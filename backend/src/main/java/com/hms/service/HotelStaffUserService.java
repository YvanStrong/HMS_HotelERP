package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HotelStaffUserService {

    private static final int MIN_PASSWORD_LEN = 8;

    private static final EnumSet<Role> CREATABLE_BY_HOTEL_ADMIN =
            EnumSet.of(
                    Role.MANAGER,
                    Role.RECEPTIONIST,
                    Role.HOUSEKEEPING,
                    Role.HOUSEKEEPING_SUPERVISOR,
                    Role.MAINTENANCE,
                    Role.FNB_STAFF,
                    Role.FINANCE);

    private static final EnumSet<Role> CREATABLE_BY_MANAGER =
            EnumSet.of(
                    Role.RECEPTIONIST,
                    Role.HOUSEKEEPING,
                    Role.HOUSEKEEPING_SUPERVISOR,
                    Role.MAINTENANCE,
                    Role.FNB_STAFF);

    private static final EnumSet<Role> VISIBLE_STAFF_ROLES =
            EnumSet.of(
                    Role.HOTEL_ADMIN,
                    Role.MANAGER,
                    Role.RECEPTIONIST,
                    Role.HOUSEKEEPING,
                    Role.HOUSEKEEPING_SUPERVISOR,
                    Role.MAINTENANCE,
                    Role.FNB_STAFF,
                    Role.FINANCE);

    private final AppUserRepository appUserRepository;
    private final HotelRepository hotelRepository;
    private final PasswordEncoder passwordEncoder;
    private final TenantAccessService tenantAccessService;

    public HotelStaffUserService(
            AppUserRepository appUserRepository,
            HotelRepository hotelRepository,
            PasswordEncoder passwordEncoder,
            TenantAccessService tenantAccessService) {
        this.appUserRepository = appUserRepository;
        this.hotelRepository = hotelRepository;
        this.passwordEncoder = passwordEncoder;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.HotelStaffUserRow> listStaff(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        tenantAccessService.assertRoleAny(Role.SUPER_ADMIN, Role.HOTEL_ADMIN, Role.MANAGER);
        return appUserRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId).stream()
                .filter(u -> VISIBLE_STAFF_ROLES.contains(u.getRole()))
                .map(this::toRow)
                .toList();
    }

    @Transactional
    public ApiDtos.HotelStaffUserRow createStaff(
            UUID hotelId, String hotelHeader, ApiDtos.HotelStaffCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal actor = tenantAccessService.currentUser();
        tenantAccessService.assertRoleAny(Role.SUPER_ADMIN, Role.HOTEL_ADMIN, Role.MANAGER);

        if (req.password() == null || req.password().length() < MIN_PASSWORD_LEN) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "Password must be at least " + MIN_PASSWORD_LEN + " characters");
        }

        Role targetRole = parseRole(req.role());
        validateCreatePermission(actor.getRole(), targetRole);

        String username = req.username().trim();
        if (appUserRepository.findByUsername(username).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "Username already exists: " + username);
        }
        String email = req.email() == null || req.email().isBlank() ? null : req.email().trim();
        if (email != null && appUserRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "Email already exists: " + email);
        }

        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));

        AppUser user = new AppUser();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(targetRole);
        user.setActive(true);
        user.setHotel(hotel);
        return toRow(appUserRepository.save(user));
    }

    @Transactional
    public ApiDtos.HotelStaffUserRow updateRole(
            UUID hotelId, String hotelHeader, UUID userId, ApiDtos.HotelStaffRoleUpdateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal actor = tenantAccessService.currentUser();
        tenantAccessService.assertRoleAny(Role.SUPER_ADMIN, Role.HOTEL_ADMIN, Role.MANAGER);
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found"));
        if (user.getHotel() == null || !hotelId.equals(user.getHotel().getId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found");
        }
        Role targetRole = parseRole(req.role());
        validateCreatePermission(actor.getRole(), targetRole);
        user.setRole(targetRole);
        return toRow(appUserRepository.save(user));
    }

    @Transactional
    public ApiDtos.HotelStaffUserRow setActive(
            UUID hotelId, String hotelHeader, UUID userId, boolean active) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        tenantAccessService.assertRoleAny(Role.SUPER_ADMIN, Role.HOTEL_ADMIN, Role.MANAGER);
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found"));
        if (user.getHotel() == null || !hotelId.equals(user.getHotel().getId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found");
        }
        user.setActive(active);
        return toRow(appUserRepository.save(user));
    }

    @Transactional
    public ApiDtos.HotelStaffUserRow resetPassword(
            UUID hotelId, String hotelHeader, UUID userId, ApiDtos.HotelStaffPasswordResetRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        tenantAccessService.assertRoleAny(Role.SUPER_ADMIN, Role.HOTEL_ADMIN, Role.MANAGER);
        if (req.newPassword() == null || req.newPassword().length() < MIN_PASSWORD_LEN) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "Password must be at least " + MIN_PASSWORD_LEN + " characters");
        }
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found"));
        if (user.getHotel() == null || !hotelId.equals(user.getHotel().getId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        return toRow(appUserRepository.save(user));
    }

    private static Role parseRole(String roleRaw) {
        if (roleRaw == null || roleRaw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROLE_REQUIRED", "Role is required");
        }
        try {
            return Role.valueOf(roleRaw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "Unsupported role: " + roleRaw);
        }
    }

    private static void validateCreatePermission(Role actorRole, Role targetRole) {
        if (targetRole == Role.SUPER_ADMIN || targetRole == Role.GUEST || targetRole == Role.CORPORATE_BOOKER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STAFF_ROLE", "Unsupported staff role");
        }
        if (actorRole == Role.SUPER_ADMIN) {
            return;
        }
        if (actorRole == Role.HOTEL_ADMIN && CREATABLE_BY_HOTEL_ADMIN.contains(targetRole)) {
            return;
        }
        if (actorRole == Role.MANAGER && CREATABLE_BY_MANAGER.contains(targetRole)) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "INSUFFICIENT_ROLE", "You cannot create users with this role");
    }

    private ApiDtos.HotelStaffUserRow toRow(AppUser u) {
        return new ApiDtos.HotelStaffUserRow(
                u.getId(),
                u.getUsername(),
                u.getEmail(),
                u.getRole().name(),
                u.isActive(),
                u.getCreatedAt());
    }
}
