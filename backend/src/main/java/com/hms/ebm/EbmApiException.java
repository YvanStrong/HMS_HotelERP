package com.hms.ebm;

import java.util.Map;

public class EbmApiException extends RuntimeException {
    private final int httpStatus;
    private final Map<String, Object> response;

    public EbmApiException(int httpStatus, String message, Map<String, Object> response) {
        super(message);
        this.httpStatus = httpStatus;
        this.response = response != null ? response : Map.of();
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public Map<String, Object> getResponse() {
        return response;
    }

    public boolean isError922() {
        Object cd = response.get("resultCd");
        if (cd == null) {
            cd = response.get("resultCode");
        }
        String s = String.valueOf(cd);
        return "922".equals(s) || s.contains("922");
    }
}
