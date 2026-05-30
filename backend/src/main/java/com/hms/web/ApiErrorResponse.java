package com.hms.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;

/** v2.3-aligned JSON error envelope for REST responses. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        String error,
        String message,
        Instant timestamp,
        String path,
        String reason,
        Map<String, String> fields) {

    public static ApiErrorResponse of(String error, String message, String path, Map<String, String> fields) {
        return new ApiErrorResponse(error, message, Instant.now(Clock.systemUTC()), path, null, fields);
    }

    public static ApiErrorResponse of(String error, String message, String path) {
        return of(error, message, path, (Map<String, String>) null);
    }

    public static ApiErrorResponse of(String error, String reason, String message, String path) {
        return new ApiErrorResponse(error, message, Instant.now(Clock.systemUTC()), path, reason, null);
    }
}
