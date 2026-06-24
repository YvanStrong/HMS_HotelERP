package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.config.JwtProperties;
import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.repository.AppUserRepository;
import com.hms.security.JwtService;
import com.hms.security.LoginAttemptService;
import com.hms.security.RolePermissions;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PosPinAuthService {

    private static final Pattern PIN_PATTERN = Pattern.compile("^\\d{4,6}$");

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final TenantAccessService tenantAccessService;
    private final LoginAttemptService loginAttemptService;
    private final TenantSubscriptionGuard tenantSubscriptionGuard;

    public PosPinAuthService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            JwtProperties jwtProperties,
            TenantAccessService tenantAccessService,
            LoginAttemptService loginAttemptService,
            TenantSubscriptionGuard tenantSubscriptionGuard) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.tenantAccessService = tenantAccessService;
        this.loginAttemptService = loginAttemptService;
        this.tenantSubscriptionGuard = tenantSubscriptionGuard;
    }

    @Transactional
    public void setPin(UUID hotelId, String hotelHeader, String pin) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        validatePinFormat(pin);
        UUID userId = tenantAccessService.currentUser().getId();
        if (userId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        AppUser user = appUserRepository.findByIdWithHotel(userId).orElseThrow(() -> notFound("User"));
        if (user.getHotel() == null || !user.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "User does not belong to hotel");
        }
        user.setPosPinHash(passwordEncoder.encode(pin));
        user.setPosPinSetAt(Instant.now());
        appUserRepository.save(user);
    }

    @Transactional(readOnly = true)
    public ApiDtos.LoginResponse pinUnlock(
            UUID hotelId, String email, String pin, HttpServletRequest httpRequest) {
        return pinLoginInternal(hotelId, email, pin, httpRequest, pinUnlockKey(email, httpRequest));
    }

    @Transactional(readOnly = true)
    public ApiDtos.LoginResponse pinLogin(
            UUID hotelId, String email, String pin, HttpServletRequest httpRequest) {
        return pinLoginInternal(hotelId, email, pin, httpRequest, pinLoginKey(email, httpRequest));
    }

    private ApiDtos.LoginResponse pinLoginInternal(
            UUID hotelId, String email, String pin, HttpServletRequest httpRequest, String key) {
        loginAttemptService.assertAllowed(key);
        if (email == null || email.isBlank() || pin == null || pin.isBlank()) {
            loginAttemptService.onFailure(key);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email and PIN required");
        }
        AppUser user = appUserRepository
                .findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> {
                    loginAttemptService.onFailure(key);
                    return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_PIN", "Invalid email or PIN");
                });
        if (!user.isActive()) {
            loginAttemptService.onFailure(key);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "Account deactivated");
        }
        if (user.getHotel() == null || !user.getHotel().getId().equals(hotelId)) {
            loginAttemptService.onFailure(key);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_PIN", "Invalid email or PIN");
        }
        if (user.getPosPinHash() == null || !passwordEncoder.matches(pin, user.getPosPinHash())) {
            loginAttemptService.onFailure(key);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_PIN", "Invalid email or PIN");
        }
        tenantSubscriptionGuard.assertLoginAllowed(user);
        loginAttemptService.onSuccess(key);
        UserPrincipal principal = UserPrincipal.fromEntity(user);
        return new ApiDtos.LoginResponse(
                jwtService.generateToken(principal, "mobile"),
                jwtService.generateRefreshToken(principal),
                jwtService.accessTokenExpirySeconds("mobile"),
                "Bearer",
                new ApiDtos.AuthUserInfo(
                        user.getId(),
                        user.getEmail(),
                        user.getUsername(),
                        principal.getRole().name(),
                        principal.getHotelId(),
                        RolePermissions.forRole(principal.getRole())));
    }

    private static final List<Role> MANAGER_AUTHORIZER_ROLES =
            List.of(Role.SUPER_ADMIN, Role.HOTEL_ADMIN, Role.MANAGER, Role.CASHIER);

    /**
     * Resolves a manager/cashier/admin user by PIN for void/discount authorization.
     * Any hotel staff may submit the request; the PIN must belong to an authorized role.
     */
    @Transactional(readOnly = true)
    public AppUser authorizeManagerPin(UUID hotelId, String pin) {
        validatePinFormat(pin);
        boolean pinMatchedNonAuthorizer = false;
        for (AppUser user : appUserRepository.findByHotel_IdWithPosPin(hotelId)) {
            if (!user.isActive() || user.getPosPinHash() == null) {
                continue;
            }
            if (!passwordEncoder.matches(pin, user.getPosPinHash())) {
                continue;
            }
            if (MANAGER_AUTHORIZER_ROLES.contains(user.getRole())) {
                return user;
            }
            pinMatchedNonAuthorizer = true;
        }
        if (pinMatchedNonAuthorizer) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE",
                    "Only managers can authorize voids");
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_PIN", "Incorrect PIN");
    }

    @Transactional(readOnly = true)
    public boolean hasPin(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        if (userId == null) return false;
        return appUserRepository
                .findById(userId)
                .map(u -> u.getPosPinHash() != null && !u.getPosPinHash().isBlank())
                .orElse(false);
    }

    private static void validatePinFormat(String pin) {
        if (pin == null || !PIN_PATTERN.matcher(pin.trim()).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PIN must be 4–6 digits");
        }
    }

    private static String pinLoginKey(String email, HttpServletRequest req) {
        return "pos-pin:" + clientIp(req) + "|" + email.trim().toLowerCase();
    }

    private static String pinUnlockKey(String email, HttpServletRequest req) {
        return "pos-pin-unlock:" + clientIp(req) + "|" + email.trim().toLowerCase();
    }

    private static String clientIp(HttpServletRequest req) {
        if (req != null) {
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                return xff.split(",")[0].trim();
            }
            if (req.getRemoteAddr() != null) {
                return req.getRemoteAddr();
            }
        }
        return "unknown";
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
