package com.hms.api;

import com.hms.entity.PricingRule;
import com.hms.entity.Promotion;
import com.hms.repository.HotelRepository;
import com.hms.security.CheckModuleEntitlement;
import com.hms.service.DynamicPricingService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Dynamic pricing rules + promotion management endpoints.
 */
@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/pricing")
@CheckModuleEntitlement("PRICING")
public class PricingController {

    private final DynamicPricingService pricingService;
    private final HotelRepository hotelRepo;

    public PricingController(DynamicPricingService pricingService, HotelRepository hotelRepo) {
        this.pricingService = pricingService;
        this.hotelRepo = hotelRepo;
    }

    // --- Pricing Rules ---

    @GetMapping("/rules")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<PricingRule> listRules(@PathVariable UUID hotelId) {
        return pricingService.listRules(hotelId);
    }

    @PostMapping("/rules")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<PricingRule> createRule(
            @PathVariable UUID hotelId,
            @RequestBody Map<String, Object> body) {
        PricingRule rule = new PricingRule();
        rule.setHotel(hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found")));
        rule.setName((String) body.getOrDefault("name", "Untitled Rule"));
        rule.setRuleType((String) body.getOrDefault("ruleType", "OCCUPANCY_BRACKET"));
        rule.setConditions(body.containsKey("conditions") ? body.get("conditions").toString() : null);
        rule.setMultiplier(new BigDecimal(body.getOrDefault("multiplier", "1.000").toString()));
        rule.setPriority((int) body.getOrDefault("priority", 0));
        return ResponseEntity.status(HttpStatus.CREATED).body(pricingService.createRule(rule));
    }

    @DeleteMapping("/rules/{ruleId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<Void> deleteRule(@PathVariable UUID hotelId, @PathVariable UUID ruleId) {
        pricingService.deleteRule(ruleId);
        return ResponseEntity.noContent().build();
    }

    // --- Rate Calendar ---

    @GetMapping("/calendar")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<Map<String, Object>> rateCalendar(
            @PathVariable UUID hotelId,
            @RequestParam(required = false) BigDecimal baseRate,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        BigDecimal base = baseRate != null ? baseRate : new BigDecimal("100.00");
        LocalDate start = from != null ? LocalDate.parse(from) : LocalDate.now();
        LocalDate end = to != null ? LocalDate.parse(to) : start.plusDays(30);

        List<Map<String, Object>> calendar = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            BigDecimal dynamicRate = pricingService.calculateDynamicRate(hotelId, base, d);
            calendar.add(Map.of(
                    "date", d.toString(),
                    "baseRate", base,
                    "dynamicRate", dynamicRate,
                    "dayOfWeek", d.getDayOfWeek().name()
            ));
        }
        return calendar;
    }

    // --- Promotions ---

    @GetMapping("/promotions")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<Promotion> listPromotions(@PathVariable UUID hotelId) {
        return pricingService.listPromotions(hotelId);
    }

    @PostMapping("/promotions")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<Promotion> createPromotion(
            @PathVariable UUID hotelId,
            @RequestBody Map<String, Object> body) {
        Promotion promo = new Promotion();
        promo.setHotel(hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found")));
        promo.setCode(body.getOrDefault("code", "").toString().toUpperCase(Locale.ROOT));
        promo.setName((String) body.get("name"));
        promo.setDiscountType(body.getOrDefault("discountType", "PERCENTAGE").toString());
        promo.setDiscountValue(new BigDecimal(body.getOrDefault("discountValue", "0").toString()));
        promo.setMinNights((int) body.getOrDefault("minNights", 1));
        if (body.containsKey("validFrom")) promo.setValidFrom(LocalDate.parse(body.get("validFrom").toString()));
        if (body.containsKey("validUntil")) promo.setValidUntil(LocalDate.parse(body.get("validUntil").toString()));
        if (body.containsKey("usageLimit")) promo.setUsageLimit((Integer) body.get("usageLimit"));
        return ResponseEntity.status(HttpStatus.CREATED).body(pricingService.createPromotion(hotelId, promo));
    }

    @PostMapping("/promotions/validate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_GUEST')")
    public Map<String, Object> validatePromoCode(
            @PathVariable UUID hotelId,
            @RequestBody Map<String, Object> body) {
        String code = body.getOrDefault("code", "").toString();
        UUID roomTypeId = body.containsKey("roomTypeId") ? UUID.fromString(body.get("roomTypeId").toString()) : null;
        int nights = (int) body.getOrDefault("nights", 1);
        BigDecimal subtotal = new BigDecimal(body.getOrDefault("subtotal", "0").toString());

        BigDecimal discount = pricingService.validatePromoCode(hotelId, code, roomTypeId, nights, subtotal);
        return Map.of("valid", true, "discount", discount, "finalTotal", subtotal.subtract(discount));
    }
}
