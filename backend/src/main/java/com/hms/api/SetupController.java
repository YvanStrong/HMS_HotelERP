package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.SetupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/setup")
public class SetupController {

    private final SetupService setupService;

    public SetupController(SetupService setupService) {
        this.setupService = setupService;
    }

    @PostMapping("/initialize")
    public ResponseEntity<ApiDtos.SetupInitializeResponse> initialize(
            @RequestHeader(value = "X-Setup-Token", required = false) String xSetupToken,
            @RequestParam(value = "setupToken", required = false) String setupTokenQuery,
            @Valid @RequestBody ApiDtos.SetupInitializeRequest body) {
        String token = firstNonBlank(xSetupToken, setupTokenQuery);
        return ResponseEntity.status(HttpStatus.CREATED).body(setupService.initialize(token, body));
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a.trim();
        }
        if (b != null && !b.isBlank()) {
            return b.trim();
        }
        return null;
    }
}
