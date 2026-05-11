package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.AppUser;
import com.hms.entity.PasswordResetToken;
import com.hms.repository.AppUserRepository;
import com.hms.repository.PasswordResetTokenRepository;
import com.hms.security.SecurityAuditService;
import com.hms.web.ApiException;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetService {

    private static final int MIN_PASSWORD_LEN = 8;
    private static final Duration TOKEN_TTL = Duration.ofHours(1);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AppUserRepository appUserRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityAuditService securityAuditService;

    @Value("${hms.frontend.base-url}")
    private String frontendBaseUrl;

    /** When true, forgot-password response includes {@code debugResetUrl} (disable in production). */
    @Value("${hms.auth.password-reset.expose-reset-link-in-json:false}")
    private boolean exposeResetLinkInJson;

    public PasswordResetService(
            AppUserRepository appUserRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            PasswordEncoder passwordEncoder,
            SecurityAuditService securityAuditService) {
        this.appUserRepository = appUserRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.securityAuditService = securityAuditService;
    }

    @Transactional
    public ApiDtos.ForgotPasswordResponse requestReset(String usernameOrEmailRaw) {
        String raw = usernameOrEmailRaw == null ? "" : usernameOrEmailRaw.trim();
        antiTimingDelay();
        if (raw.isEmpty()) {
            return anonymousForgotResponse();
        }

        Optional<AppUser> userOpt = resolveUser(raw);
        if (userOpt.isEmpty()) {
            return anonymousForgotResponse();
        }
        AppUser user = userOpt.get();
        if (!user.isActive()) {
            return anonymousForgotResponse();
        }

        passwordResetTokenRepository.deletePendingForUser(user.getId());

        byte[] tokenBytes = new byte[32];
        RANDOM.nextBytes(tokenBytes);
        String plainToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        String tokenHash = sha256Hex(plainToken);

        PasswordResetToken row = new PasswordResetToken();
        row.setAppUser(user);
        row.setTokenHash(tokenHash);
        row.setExpiresAt(Instant.now().plus(TOKEN_TTL));
        passwordResetTokenRepository.save(row);

        securityAuditService.logEvent(
                "PASSWORD_RESET_REQUESTED",
                user.getId(),
                user.getHotel() != null ? user.getHotel().getId() : null,
                Map.of("via", "forgot_password"));

        String debugUrl = null;
        if (exposeResetLinkInJson) {
            String base = frontendBaseUrl.replaceAll("/$", "");
            debugUrl = base + "/reset-password?token=" + encodeURIComponentSafe(plainToken);
        }

        String msg =
                debugUrl != null
                        ? "Use the link below to set a new password. (Link-in-response is enabled for this environment; turn it off in production.)"
                        : "If an account exists for that username or email, check your inbox for reset instructions or contact your administrator.";
        return new ApiDtos.ForgotPasswordResponse(msg, debugUrl);
    }

    private static String encodeURIComponentSafe(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    @Transactional
    public void completeReset(String tokenRaw, String newPassword) {
        if (newPassword == null || newPassword.length() < MIN_PASSWORD_LEN) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "WEAK_PASSWORD",
                    "Password must be at least " + MIN_PASSWORD_LEN + " characters");
        }
        if (tokenRaw == null || tokenRaw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TOKEN", "Reset token is required");
        }
        String hash = sha256Hex(tokenRaw.trim());
        PasswordResetToken row =
                passwordResetTokenRepository.findByTokenHash(hash).orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST, "INVALID_TOKEN", "This reset link is invalid or has expired"));

        if (row.getUsedAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TOKEN_USED", "This reset link was already used");
        }
        if (row.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TOKEN_EXPIRED", "This reset link has expired");
        }

        AppUser user = appUserRepository
                .findById(row.getAppUser().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        if (!user.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "This account is deactivated");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        appUserRepository.save(user);

        row.setUsedAt(Instant.now());
        passwordResetTokenRepository.save(row);

        securityAuditService.logEvent(
                "PASSWORD_RESET_COMPLETED",
                user.getId(),
                user.getHotel() != null ? user.getHotel().getId() : null,
                Map.of("username", user.getUsername()));
    }

    private Optional<AppUser> resolveUser(String raw) {
        if (raw.contains("@")) {
            return appUserRepository.findByEmailIgnoreCase(raw);
        }
        return appUserRepository.findByUsername(raw);
    }

    private static ApiDtos.ForgotPasswordResponse anonymousForgotResponse() {
        return new ApiDtos.ForgotPasswordResponse(
                "If an account exists for that username or email, check your inbox for reset instructions or contact your administrator.",
                null);
    }

    private static void antiTimingDelay() {
        try {
            Thread.sleep(50 + RANDOM.nextInt(120));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
