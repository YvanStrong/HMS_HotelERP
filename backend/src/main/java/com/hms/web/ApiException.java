package com.hms.web;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    /** Machine-readable code (v2.3 {@code error} field); never null after construction. */
    private final String errorCode;

    public ApiException(HttpStatus status, String message) {
        this(status, null, message);
    }

    public ApiException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode != null ? errorCode : defaultCode(status);
    }

    private static String defaultCode(HttpStatus status) {
        if (status == HttpStatus.BAD_REQUEST) return "BAD_REQUEST";
        if (status == HttpStatus.UNAUTHORIZED) return "UNAUTHORIZED";
        if (status == HttpStatus.FORBIDDEN) return "FORBIDDEN";
        if (status == HttpStatus.NOT_FOUND) return "NOT_FOUND";
        if (status == HttpStatus.CONFLICT) return "CONFLICT";
        if (status == HttpStatus.UNPROCESSABLE_ENTITY) return "UNPROCESSABLE_ENTITY";
        if (status == HttpStatus.PAYMENT_REQUIRED) return "PAYMENT_REQUIRED";
        if (status == HttpStatus.SERVICE_UNAVAILABLE) return "SERVICE_UNAVAILABLE";
        if (status == HttpStatus.TOO_MANY_REQUESTS) return "TOO_MANY_REQUESTS";
        return status.name();
    }
}
