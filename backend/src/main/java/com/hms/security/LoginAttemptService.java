package com.hms.security;

import com.hms.web.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class LoginAttemptService {

    private record AttemptWindow(int failures, Instant firstFailureAt, Instant lockedUntil) {}

    private final Map<String, AttemptWindow> attempts = new ConcurrentHashMap<>();
    private final int maxAttempts;
    private final Duration window;
    private final Duration lockout;

    public LoginAttemptService(
            @Value("${hms.auth.login.max-attempts:5}") int maxAttempts,
            @Value("${hms.auth.login.window-minutes:15}") long windowMinutes,
            @Value("${hms.auth.login.lockout-minutes:15}") long lockoutMinutes) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.window = Duration.ofMinutes(Math.max(1, windowMinutes));
        this.lockout = Duration.ofMinutes(Math.max(1, lockoutMinutes));
    }

    public void assertAllowed(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        AttemptWindow state = attempts.get(key);
        if (state == null || state.lockedUntil() == null) {
            return;
        }
        if (state.lockedUntil().isAfter(Instant.now())) {
            throw new ApiException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "LOGIN_TEMP_LOCKED",
                    "Too many failed login attempts. Try again later.");
        }
        attempts.remove(key);
    }

    public void onFailure(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        Instant now = Instant.now();
        attempts.compute(
                key,
                (k, current) -> {
                    if (current == null || current.firstFailureAt().plus(window).isBefore(now)) {
                        return new AttemptWindow(1, now, null);
                    }
                    int failures = current.failures() + 1;
                    if (failures >= maxAttempts) {
                        return new AttemptWindow(failures, current.firstFailureAt(), now.plus(lockout));
                    }
                    return new AttemptWindow(failures, current.firstFailureAt(), null);
                });
    }

    public void onSuccess(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        attempts.remove(key);
    }
}
