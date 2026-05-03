package com.hms.api;

import com.hms.api.dto.SelfOrderDtos;
import com.hms.service.SelfOrderService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/hotels/{hotelId}/self-order")
public class PublicSelfOrderController {

    private final SelfOrderService selfOrderService;

    public PublicSelfOrderController(SelfOrderService selfOrderService) {
        this.selfOrderService = selfOrderService;
    }

    @GetMapping("/menu")
    public SelfOrderDtos.PublicMenuResponse menu(@PathVariable UUID hotelId) {
        return selfOrderService.publicMenu(hotelId);
    }

    @PostMapping
    public ResponseEntity<SelfOrderDtos.CreatePublicOrderResponse> placeOrder(
            @PathVariable UUID hotelId, @Valid @RequestBody SelfOrderDtos.CreatePublicOrderRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(selfOrderService.createPublicOrder(hotelId, body));
    }

    @GetMapping("/track")
    public SelfOrderDtos.TrackOrderResponse track(
            @PathVariable UUID hotelId, @RequestParam("token") UUID trackToken) {
        return selfOrderService.trackOrder(hotelId, trackToken);
    }

    @GetMapping("/board")
    public SelfOrderDtos.BoardResponse board(
            @PathVariable UUID hotelId, @RequestParam(required = false) String key) {
        return selfOrderService.boardOrders(hotelId, key);
    }
}
