package com.hms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.entity.Hotel;
import com.hms.entity.PricingRule;
import com.hms.entity.Promotion;
import com.hms.repository.HotelRepository;
import com.hms.repository.PricingRuleRepository;
import com.hms.repository.PromotionRepository;
import com.hms.repository.RoomRepository;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dynamic pricing engine — applies occupancy/season/day-of-week multipliers
 * to base room rates and validates promotional discount codes.
 */
@Service
public class DynamicPricingService {

    private static final Logger log = LoggerFactory.getLogger(DynamicPricingService.class);

    private final PricingRuleRepository ruleRepo;
    private final PromotionRepository promoRepo;
    private final RoomRepository roomRepo;
    private final HotelRepository hotelRepo;
    private final ObjectMapper objectMapper;

    public DynamicPricingService(PricingRuleRepository ruleRepo, PromotionRepository promoRepo,
                                  RoomRepository roomRepo, HotelRepository hotelRepo, ObjectMapper objectMapper) {
        this.ruleRepo = ruleRepo;
        this.promoRepo = promoRepo;
        this.roomRepo = roomRepo;
        this.hotelRepo = hotelRepo;
        this.objectMapper = objectMapper;
    }

    /**
     * Calculate the dynamic rate for a room type on a given date.
     * Applies all active pricing rules in priority order (multiplicative stacking).
     */
    public BigDecimal calculateDynamicRate(UUID hotelId, BigDecimal baseRate, LocalDate date) {
        List<PricingRule> rules = ruleRepo.findByHotel_IdAndActiveTrueOrderByPriorityDesc(hotelId);
        BigDecimal effectiveRate = baseRate;

        for (PricingRule rule : rules) {
            if (ruleApplies(rule, hotelId, date)) {
                effectiveRate = effectiveRate.multiply(rule.getMultiplier()).setScale(2, RoundingMode.HALF_UP);
                log.debug("Applied rule '{}' ({}x) for date {} → rate now {}",
                        rule.getName(), rule.getMultiplier(), date, effectiveRate);
            }
        }
        return effectiveRate;
    }

    private boolean ruleApplies(PricingRule rule, UUID hotelId, LocalDate date) {
        try {
            String conditions = rule.getConditions();
            if (conditions == null || conditions.isBlank()) return true;

            @SuppressWarnings("unchecked")
            Map<String, Object> cond = objectMapper.readValue(conditions, Map.class);

            return switch (rule.getRuleType()) {
                case "DAY_OF_WEEK" -> {
                    Object days = cond.get("days");
                    if (days instanceof List<?> dayList) {
                        DayOfWeek today = date.getDayOfWeek();
                        yield dayList.stream().anyMatch(d -> today.name().equalsIgnoreCase(d.toString()));
                    }
                    yield false;
                }
                case "OCCUPANCY_BRACKET" -> {
                    long totalRooms = roomRepo.countByHotel_Id(hotelId);
                    if (totalRooms == 0) yield false;
                    // Occupancy check is approximate — uses total rooms, not date-specific
                    Number min = (Number) cond.getOrDefault("min_occupancy", 0);
                    Number max = (Number) cond.getOrDefault("max_occupancy", 100);
                    // Placeholder: actual occupancy would need reservation count for the date
                    yield true; // Always apply bracket if configured — refine with real occupancy later
                }
                case "SEASON" -> {
                    String from = (String) cond.get("from");
                    String to = (String) cond.get("to");
                    if (from != null && to != null) {
                        LocalDate seasonStart = LocalDate.parse(from);
                        LocalDate seasonEnd = LocalDate.parse(to);
                        yield !date.isBefore(seasonStart) && !date.isAfter(seasonEnd);
                    }
                    yield false;
                }
                default -> true;
            };
        } catch (Exception e) {
            log.warn("Failed to evaluate pricing rule {}: {}", rule.getId(), e.getMessage());
            return false;
        }
    }

    // --- Promotion Management ---

    @Transactional(readOnly = true)
    public List<Promotion> listPromotions(UUID hotelId) {
        return promoRepo.findByHotel_IdOrderByCreatedAtDesc(hotelId);
    }

    @Transactional
    public Promotion createPromotion(UUID hotelId, Promotion proto) {
        promoRepo.findByHotel_IdAndCode(hotelId, proto.getCode()).ifPresent(existing -> {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_PROMO_CODE",
                    "Promotion code '" + proto.getCode() + "' already exists.");
        });
        if (proto.getAppliesTo() == null || proto.getAppliesTo().isBlank()) {
            proto.setAppliesTo("ROOMS");
        } else {
            proto.setAppliesTo(proto.getAppliesTo().trim().toUpperCase(Locale.ROOT));
        }
        return promoRepo.save(proto);
    }

    @Transactional(readOnly = true)
    public List<Promotion> listPosPromotions(UUID hotelId) {
        return promoRepo.findActivePosPromotions(hotelId);
    }

    @Transactional
    public Promotion createPosPromotion(UUID hotelId, String code, String name, String discountType,
            BigDecimal discountValue, Integer usageLimit) {
        Hotel hotel = hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
        String normalizedCode = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (normalizedCode.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_CODE_REQUIRED", "Promotion code is required.");
        }
        String type = discountType == null ? "" : discountType.trim().toUpperCase(Locale.ROOT);
        if (!type.equals("PERCENTAGE") && !type.equals("FIXED_AMOUNT")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DISCOUNT_TYPE",
                    "discountType must be PERCENTAGE or FIXED_AMOUNT.");
        }
        if (discountValue == null || discountValue.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DISCOUNT_VALUE",
                    "discountValue must be greater than zero.");
        }
        if (type.equals("PERCENTAGE") && discountValue.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DISCOUNT_VALUE",
                    "Percentage discount cannot exceed 100.");
        }

        Promotion promo = new Promotion();
        promo.setHotel(hotel);
        promo.setCode(normalizedCode);
        promo.setName(name == null || name.isBlank() ? normalizedCode : name.trim());
        promo.setDiscountType(type);
        promo.setDiscountValue(discountValue);
        promo.setMinNights(1);
        promo.setUsageLimit(usageLimit);
        promo.setUsageCount(0);
        promo.setAppliesTo("POS");
        promo.setActive(true);
        return createPromotion(hotelId, promo);
    }

    /**
     * Validate and return the discount for a promotion code.
     * @return the discount amount (positive) to subtract from the total, or BigDecimal.ZERO if invalid.
     */
    @Transactional(readOnly = true)
    public BigDecimal validatePromoCode(UUID hotelId, String code, UUID roomTypeId, int nights, BigDecimal subtotal) {
        Optional<Promotion> opt = promoRepo.findByHotel_IdAndCode(hotelId, code.toUpperCase(Locale.ROOT));
        if (opt.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PROMO_CODE", "Promotion code not found.");
        }
        Promotion promo = opt.get();
        String appliesTo = promo.getAppliesTo() == null ? "ROOMS" : promo.getAppliesTo().trim().toUpperCase(Locale.ROOT);
        if ("POS".equals(appliesTo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_NOT_FOR_ROOMS",
                    "This promotion is for POS only.");
        }

        assertPromoUsable(promo);

        if (nights < promo.getMinNights()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_MIN_NIGHTS",
                    "Minimum " + promo.getMinNights() + " nights required for this promotion.");
        }

        return computeDiscount(promo, subtotal);
    }

    /**
     * Validate a POS promotion and return discount amount for the given cart subtotal.
     */
    @Transactional(readOnly = true)
    public AppliedPosPromo validatePosPromoCode(UUID hotelId, String code, BigDecimal subtotal) {
        if (code == null || code.isBlank()) {
            return AppliedPosPromo.none();
        }
        Optional<Promotion> opt = promoRepo.findByHotel_IdAndCode(hotelId, code.trim().toUpperCase(Locale.ROOT));
        if (opt.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PROMO_CODE", "Promotion code not found.");
        }
        Promotion promo = opt.get();
        String appliesTo = promo.getAppliesTo() == null ? "ROOMS" : promo.getAppliesTo().trim().toUpperCase(Locale.ROOT);
        if ("ROOMS".equals(appliesTo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_NOT_FOR_POS",
                    "This promotion is for room bookings only.");
        }
        assertPromoUsable(promo);
        BigDecimal discount = computeDiscount(promo, subtotal);
        return new AppliedPosPromo(promo, discount);
    }

    private void assertPromoUsable(Promotion promo) {
        if (!promo.isActive()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_INACTIVE", "This promotion is no longer active.");
        }
        LocalDate today = LocalDate.now();
        if (promo.getValidFrom() != null && today.isBefore(promo.getValidFrom())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_NOT_STARTED", "This promotion has not started yet.");
        }
        if (promo.getValidUntil() != null && today.isAfter(promo.getValidUntil())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_EXPIRED", "This promotion has expired.");
        }
        if (promo.getUsageLimit() != null && promo.getUsageCount() >= promo.getUsageLimit()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROMO_EXHAUSTED", "This promotion has reached its usage limit.");
        }
    }

    private BigDecimal computeDiscount(Promotion promo, BigDecimal subtotal) {
        BigDecimal base = subtotal == null ? BigDecimal.ZERO : subtotal;
        return switch (promo.getDiscountType()) {
            case "PERCENTAGE" -> base.multiply(promo.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            case "FIXED_AMOUNT" -> promo.getDiscountValue().min(base).setScale(2, RoundingMode.HALF_UP);
            default -> BigDecimal.ZERO;
        };
    }

    @Transactional
    public void incrementUsage(UUID hotelId, String code) {
        promoRepo.findByHotel_IdAndCode(hotelId, code.toUpperCase(Locale.ROOT)).ifPresent(p -> {
            p.setUsageCount(p.getUsageCount() + 1);
            promoRepo.save(p);
        });
    }

    public record AppliedPosPromo(Promotion promotion, BigDecimal discountAmount) {
        public static AppliedPosPromo none() {
            return new AppliedPosPromo(null, BigDecimal.ZERO);
        }

        public boolean applied() {
            return promotion != null && discountAmount != null && discountAmount.signum() > 0;
        }
    }

    // --- Pricing Rule CRUD ---

    @Transactional(readOnly = true)
    public List<PricingRule> listRules(UUID hotelId) {
        return ruleRepo.findByHotel_IdOrderByPriorityDesc(hotelId);
    }

    @Transactional
    public PricingRule createRule(PricingRule rule) {
        return ruleRepo.save(rule);
    }

    @Transactional
    public void deleteRule(UUID ruleId) {
        ruleRepo.deleteById(ruleId);
    }
}
