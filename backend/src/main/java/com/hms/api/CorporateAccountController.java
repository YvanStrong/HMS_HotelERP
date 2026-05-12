package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.CorporateAccountService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/corporate-accounts")
@RequiredArgsConstructor
public class CorporateAccountController {

    private final CorporateAccountService corporateAccountService;

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.CorporateAccountRow> list(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return corporateAccountService.list(hotelId, hotelHeader);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDtos.CorporateAccountRow create(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.CorporateAccountCreateRequest body) {
        return corporateAccountService.create(hotelId, hotelHeader, body);
    }
}
