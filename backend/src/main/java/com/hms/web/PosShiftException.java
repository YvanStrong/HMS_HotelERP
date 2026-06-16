package com.hms.web;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class PosShiftException extends ApiException {

    private final Map<String, String> fields;

    public PosShiftException(HttpStatus status, String errorCode, String message, Map<String, String> fields) {
        super(status, errorCode, message);
        this.fields = fields;
    }
}
