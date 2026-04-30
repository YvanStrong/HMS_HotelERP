package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.config.JwtProperties;
import com.hms.entity.AppUser;
import com.hms.repository.AppUserRepository;
import com.hms.service.GuestPortalRegistrationService;
import com.hms.security.JwtService;
import com.hms.security.RolePermissions;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import jakarta.validation.Valid;
import java.util.Optional;
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

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final AppUserRepository appUserRepository;
    private final GuestPortalRegistrationService guestPortalRegistrationService;

    public AuthController(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            JwtProperties jwtProperties,
            AppUserRepository appUserRepository,
            GuestPortalRegistrationService guestPortalRegistrationService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.appUserRepository = appUserRepository;
        this.guestPortalRegistrationService = guestPortalRegistrationService;
    }

    @PostMapping("/register-guest")
    public ResponseEntity<ApiDtos.LoginResponse> registerGuest(@Valid @RequestBody ApiDtos.RegisterGuestRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(guestPortalRegistrationService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiDtos.LoginResponse> login(@Valid @RequestBody ApiDtos.LoginRequest request) {
        Optional<AppUser> resolved = resolveUser(request);
        if (resolved.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password");
        }
        AppUser user = resolved.get();
        if (!user.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "This staff account is deactivated");
        }
        try {
            var auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getUsername(), request.password()));
            UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
            return ResponseEntity.ok(buildLoginResponse(principal));
        } catch (BadCredentialsException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiDtos.LoginResponse> refresh(@Valid @RequestBody ApiDtos.RefreshTokenRequest request) {
        var userId = jwtService.parseRefreshTokenUserId(request.refreshToken());
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "User no longer exists"));
        if (!user.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "This staff account is deactivated");
        }
        return ResponseEntity.ok(buildLoginResponse(UserPrincipal.fromEntity(user)));
    }

    private Optional<AppUser> resolveUser(ApiDtos.LoginRequest request) {
        if (request.email() != null && !request.email().isBlank()) {
            return appUserRepository.findByEmailIgnoreCase(request.email().trim());
        }
        return appUserRepository.findByUsername(request.username().trim());
    }

    private ApiDtos.LoginResponse buildLoginResponse(UserPrincipal principal) {
        AppUser u = appUserRepository
                .findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "USER_NOT_FOUND", "User missing"));
        return new ApiDtos.LoginResponse(
                jwtService.generateToken(principal),
                jwtService.generateRefreshToken(principal),
                jwtProperties.getExpirationMs() / 1000,
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
