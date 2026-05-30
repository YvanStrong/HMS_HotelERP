package com.hms.web;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class SubscriptionAccessException extends ApiException {

    private final String reason;

    public SubscriptionAccessException(HttpStatus status, String code, String reason, String message) {
        super(status, code, message);
        this.reason = reason;
    }
}
