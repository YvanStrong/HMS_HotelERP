package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.config.JwtProperties;
import com.hms.entity.AppUser;
import com.hms.repository.AppUserRepository;
import com.hms.domain.Role;
import com.hms.service.GuestPortalRegistrationService;
import com.hms.service.PasswordResetService;
import com.hms.service.PlatformTenantService;
import com.hms.service.TenantSubscriptionGuard;
import com.hms.security.LoginAttemptService;
import com.hms.security.SecurityAuditService;
import com.hms.security.JwtService;
import com.hms.security.RolePermissions;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final AppUserRepository appUserRepository;
    private final GuestPortalRegistrationService guestPortalRegistrationService;
    private final LoginAttemptService loginAttemptService;
    private final SecurityAuditService securityAuditService;
    private final PasswordResetService passwordResetService;
    private final PlatformTenantService platformTenantService;
    private final TenantSubscriptionGuard tenantSubscriptionGuard;

    public AuthController(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            JwtProperties jwtProperties,
            AppUserRepository appUserRepository,
            GuestPortalRegistrationService guestPortalRegistrationService,
            LoginAttemptService loginAttemptService,
            SecurityAuditService securityAuditService,
            PasswordResetService passwordResetService,
            PlatformTenantService platformTenantService,
            TenantSubscriptionGuard tenantSubscriptionGuard) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.appUserRepository = appUserRepository;
        this.guestPortalRegistrationService = guestPortalRegistrationService;
        this.loginAttemptService = loginAttemptService;
        this.securityAuditService = securityAuditService;
        this.passwordResetService = passwordResetService;
        this.platformTenantService = platformTenantService;
        this.tenantSubscriptionGuard = tenantSubscriptionGuard;
    }

    @PostMapping("/register-guest")
    public ResponseEntity<ApiDtos.LoginResponse> registerGuest(@Valid @RequestBody ApiDtos.RegisterGuestRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(guestPortalRegistrationService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiDtos.LoginResponse> login(
            @Valid @RequestBody ApiDtos.LoginRequest request, HttpServletRequest httpRequest) {
        String clientType = clientType(httpRequest);
        String loginKey = loginKey(request, httpRequest);
        loginAttemptService.assertAllowed(loginKey);
        Optional<AppUser> resolved = resolveUser(request);
        if (resolved.isEmpty()) {
            loginAttemptService.onFailure(loginKey);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password");
        }
        AppUser user = resolved.get();
        if (!user.isActive()) {
            loginAttemptService.onFailure(loginKey);
            securityAuditService.logEvent(
                    "LOGIN_BLOCKED_DISABLED_ACCOUNT",
                    user.getId(),
                    user.getHotel() != null ? user.getHotel().getId() : null,
                    java.util.Map.of("username", user.getUsername()));
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "This staff account is deactivated");
        }
        try {
            var auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getUsername(), request.password()));
            UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
            tenantSubscriptionGuard.assertLoginAllowed(user);
            loginAttemptService.onSuccess(loginKey);
            securityAuditService.logEvent(
                    "LOGIN_SUCCESS",
                    principal.getId(),
                    principal.getHotelId(),
                    java.util.Map.of("username", principal.getUsername()));
            if (principal.getRole() == Role.SUPER_ADMIN) {
                try {
                    platformTenantService.recordCrossPlatformAudit(
                            principal.getId(),
                            "SUPER_ADMIN_LOGIN",
                            null,
                            java.util.Map.of("username", principal.getUsername()),
                            httpRequest);
                } catch (Exception ex) {
                    log.warn("Could not persist platform audit row for super admin login: {}", ex.getMessage());
                }
            }
            return ResponseEntity.ok(buildLoginResponse(principal, clientType));
        } catch (BadCredentialsException e) {
            loginAttemptService.onFailure(loginKey);
            securityAuditService.logEvent(
                    "LOGIN_FAILED_BAD_CREDENTIALS",
                    user.getId(),
                    user.getHotel() != null ? user.getHotel().getId() : null,
                    java.util.Map.of("username", user.getUsername()));
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password");
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiDtos.ForgotPasswordResponse> forgotPassword(
            @Valid @RequestBody ApiDtos.ForgotPasswordRequest request) {
        return ResponseEntity.ok(passwordResetService.requestReset(request.usernameOrEmail()));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiDtos.MessageResponse> resetPasswordWithToken(
            @Valid @RequestBody ApiDtos.ResetPasswordWithTokenRequest request) {
        passwordResetService.completeReset(request.token(), request.newPassword());
        return ResponseEntity.ok(new ApiDtos.MessageResponse("Password updated. You can sign in with your new password."));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiDtos.LoginResponse> refresh(
            @Valid @RequestBody ApiDtos.RefreshTokenRequest request, HttpServletRequest httpRequest) {
        String clientType = clientType(httpRequest);
        var userId = jwtService.parseRefreshTokenUserId(request.refreshToken());
        AppUser user = appUserRepository
                .findByIdWithHotel(userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "User no longer exists"));
        if (!user.isActive()) {
            securityAuditService.logEvent(
                    "REFRESH_BLOCKED_DISABLED_ACCOUNT",
                    user.getId(),
                    user.getHotel() != null ? user.getHotel().getId() : null,
                    java.util.Map.of());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "This staff account is deactivated");
        }
        tenantSubscriptionGuard.assertRefreshAllowed(user);
        return ResponseEntity.ok(buildLoginResponse(UserPrincipal.fromEntity(user), clientType));
    }

    private Optional<AppUser> resolveUser(ApiDtos.LoginRequest request) {
        if (request.email() != null && !request.email().isBlank()) {
            return appUserRepository.findByEmailIgnoreCase(request.email().trim());
        }
        return appUserRepository.findByUsername(request.username().trim());
    }

    private static String loginKey(ApiDtos.LoginRequest request, HttpServletRequest httpRequest) {
        String identity = request.email() != null && !request.email().isBlank()
                ? request.email().trim().toLowerCase()
                : request.username().trim().toLowerCase();
        String ip = clientIp(httpRequest);
        return identity + "|" + ip;
    }

    private static String clientIp(HttpServletRequest req) {
        if (req == null) {
            return "unknown";
        }
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String addr = req.getRemoteAddr();
        return addr != null && !addr.isBlank() ? addr : "unknown";
    }

    private static String clientType(HttpServletRequest req) {
        if (req == null) {
            return null;
        }
        String v = req.getHeader("X-Client-Type");
        return v != null && !v.isBlank() ? v.trim() : null;
    }

    private ApiDtos.LoginResponse buildLoginResponse(UserPrincipal principal, String clientType) {
        AppUser u = appUserRepository
                .findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "USER_NOT_FOUND", "User missing"));
        return new ApiDtos.LoginResponse(
                jwtService.generateToken(principal, clientType),
                jwtService.generateRefreshToken(principal),
                jwtService.accessTokenExpirySeconds(clientType),
                "Bearer",
                new ApiDtos.AuthUserInfo(
                        u.getId(),
                        u.getEmail(),
                        u.getUsername(),
                        principal.getRole().name(),
                        principal.getHotelId(),
                        RolePermissions.forRole(principal.getRole())));
    }
}
