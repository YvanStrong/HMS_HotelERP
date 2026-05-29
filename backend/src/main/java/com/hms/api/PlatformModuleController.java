package com.hms.api;

import com.hms.api.dto.PlatformDtos;
import com.hms.domain.ModuleTier;
import com.hms.entity.HotelModuleAuditLog;
import com.hms.entity.PlatformBusinessCategory;
import com.hms.entity.PlatformModule;
import com.hms.repository.HotelModuleAuditLogRepository;
import com.hms.repository.PlatformBusinessCategoryRepository;
import com.hms.repository.PlatformModuleRepository;
import com.hms.security.TenantAccessService;
import com.hms.service.HotelModuleEntitlementService;
import com.hms.web.ApiException;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/platform")
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class PlatformModuleController {

    private final PlatformModuleRepository moduleRepository;
    private final PlatformBusinessCategoryRepository categoryRepository;
    private final HotelModuleEntitlementService entitlementService;
    private final HotelModuleAuditLogRepository auditLogRepository;
    private final TenantAccessService tenantAccessService;

    public PlatformModuleController(
            PlatformModuleRepository moduleRepository,
            PlatformBusinessCategoryRepository categoryRepository,
            HotelModuleEntitlementService entitlementService,
            HotelModuleAuditLogRepository auditLogRepository,
            TenantAccessService tenantAccessService) {
        this.moduleRepository = moduleRepository;
        this.categoryRepository = categoryRepository;
        this.entitlementService = entitlementService;
        this.auditLogRepository = auditLogRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @GetMapping("/categories")
    public List<PlatformDtos.BusinessCategoryRow> listCategories() {
        return categoryRepository.findAllActiveWithModules().stream().map(this::toCategoryRow).toList();
    }

    @PostMapping("/categories")
    public PlatformDtos.BusinessCategoryRow createCategory(@Valid @RequestBody PlatformDtos.UpsertBusinessCategoryRequest body) {
        PlatformBusinessCategory category = new PlatformBusinessCategory();
        category.setCode(body.code().trim().toUpperCase());
        applyCategoryFields(category, body);
        return toCategoryRow(categoryRepository.save(category));
    }

    @GetMapping("/categories/{id}")
    public PlatformDtos.BusinessCategoryRow getCategory(@PathVariable UUID id) {
        return categoryRepository
                .findByIdWithModules(id)
                .map(this::toCategoryRow)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Category not found"));
    }

    @PutMapping("/categories/{id}")
    public PlatformDtos.BusinessCategoryRow updateCategory(
            @PathVariable UUID id, @Valid @RequestBody PlatformDtos.UpsertBusinessCategoryRequest body) {
        PlatformBusinessCategory category = categoryRepository
                .findByIdWithModules(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Category not found"));
        applyCategoryFields(category, body);
        return toCategoryRow(categoryRepository.save(category));
    }

    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@PathVariable UUID id) {
        PlatformBusinessCategory category = categoryRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Category not found"));
        if ("FULL_HOTEL".equals(category.getCode())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FULL_HOTEL cannot be deleted.");
        }
        category.setActive(false);
        categoryRepository.save(category);
    }

    @GetMapping("/modules")
    public Map<String, List<PlatformDtos.PlatformModuleRow>> listModules() {
        Map<String, List<PlatformDtos.PlatformModuleRow>> grouped = new LinkedHashMap<>();
        for (PlatformModule module : moduleRepository.findAllByActiveTrueOrderBySortOrderAsc()) {
            grouped.computeIfAbsent(module.getTier().name(), ignored -> new ArrayList<>()).add(toModuleRow(module));
        }
        return grouped;
    }

    @GetMapping("/modules/catalog")
    public List<PlatformDtos.PlatformModuleRow> moduleCatalog() {
        return moduleRepository.findAllByOrderBySortOrderAsc().stream().map(this::toModuleRow).toList();
    }

    @PatchMapping("/modules/{moduleKey}")
    public PlatformDtos.PlatformModuleRow updateModuleCatalog(
            @PathVariable String moduleKey, @RequestBody PlatformDtos.UpdatePlatformModuleRequest body) {
        PlatformModule module = moduleRepository
                .findByModuleKey(moduleKey.trim().toUpperCase())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Module not found"));
        if (body.label() != null && !body.label().trim().isEmpty()) {
            module.setLabel(body.label().trim());
        }
        if (body.description() != null) {
            module.setDescription(trimOrNull(body.description()));
        }
        if (body.tier() != null) {
            if (module.isLocked()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Core modules cannot be moved.");
            }
            ModuleTier tier = parseEditableTier(body.tier());
            module.setTier(tier);
            module.setPaidAddon(tier == ModuleTier.ADDON);
        }
        if (Boolean.TRUE.equals(body.clearPrice())) {
            module.setPricePerMonth(null);
        } else if (body.pricePerMonth() != null) {
            if (body.pricePerMonth().compareTo(BigDecimal.ZERO) < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Price cannot be negative.");
            }
            module.setPricePerMonth(body.pricePerMonth());
        }
        if (body.active() != null) {
            if (module.isLocked() && !body.active()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Core modules cannot be deactivated.");
            }
            module.setActive(body.active());
        }
        if (body.sortOrder() != null) {
            module.setSortOrder(body.sortOrder());
        }
        return toModuleRow(moduleRepository.save(module));
    }

    @GetMapping("/modules/addons")
    public List<PlatformDtos.PlatformModuleRow> listAddons() {
        return moduleRepository.findByTier(ModuleTier.ADDON).stream()
                .filter(PlatformModule::isActive)
                .map(this::toModuleRow)
                .toList();
    }

    @GetMapping("/hotels/{hotelId}/modules")
    public PlatformDtos.HotelModuleEntitlementsResponse hotelModules(@PathVariable UUID hotelId) {
        return entitlementService.getEntitlementsForHotel(hotelId);
    }

    @PutMapping("/hotels/{hotelId}/modules/category")
    public PlatformDtos.HotelModuleEntitlementsResponse applyCategory(
            @PathVariable UUID hotelId, @RequestBody PlatformDtos.ApplyCategoryRequest body) {
        return entitlementService.applyCategory(hotelId, body.categoryId(), currentUserId());
    }

    @PatchMapping("/hotels/{hotelId}/modules/{moduleKey}")
    public PlatformDtos.UpdateModuleEntitlementResponse updateModule(
            @PathVariable UUID hotelId,
            @PathVariable String moduleKey,
            @RequestBody PlatformDtos.UpdateModuleEntitlementRequest body) {
        return entitlementService.updateModuleEntitlement(
                hotelId,
                moduleKey,
                Boolean.TRUE.equals(body.enabled()),
                body.showWhenDisabled(),
                body.billingStatus(),
                currentUserId(),
                body.reason());
    }

    @PostMapping("/hotels/{hotelId}/modules/{moduleKey}/activate-addon")
    public PlatformDtos.HotelModuleEntitlementsResponse activateAddon(
            @PathVariable UUID hotelId,
            @PathVariable String moduleKey,
            @RequestBody(required = false) PlatformDtos.ActivateAddonRequest body) {
        return entitlementService.activateAddon(
                hotelId, moduleKey, body != null ? body.billingStatus() : "addon", currentUserId());
    }

    @DeleteMapping("/hotels/{hotelId}/modules/{moduleKey}/addon")
    public PlatformDtos.HotelModuleEntitlementsResponse deactivateAddon(
            @PathVariable UUID hotelId, @PathVariable String moduleKey) {
        return entitlementService.deactivateAddon(hotelId, moduleKey, currentUserId());
    }

    @GetMapping("/hotels/{hotelId}/modules/audit")
    public List<PlatformDtos.HotelModuleAuditRow> audit(@PathVariable UUID hotelId) {
        return auditLogRepository.findByHotelIdOrderByChangedAtDesc(hotelId).stream()
                .map(this::toAuditRow)
                .toList();
    }

    private void applyCategoryFields(PlatformBusinessCategory category, PlatformDtos.UpsertBusinessCategoryRequest body) {
        category.setName(body.name().trim());
        category.setDescription(trimOrNull(body.description()));
        category.setIcon(trimOrNull(body.icon()));
        List<String> keys = body.moduleKeys() != null
                ? body.moduleKeys().stream().map(key -> key.trim().toUpperCase()).toList()
                : List.of();
        category.getModules().clear();
        category.getModules().addAll(moduleRepository.findByModuleKeyIn(keys));
    }

    private PlatformDtos.BusinessCategoryRow toCategoryRow(PlatformBusinessCategory category) {
        return new PlatformDtos.BusinessCategoryRow(
                category.getId(),
                category.getCode(),
                category.getName(),
                category.getDescription(),
                category.getIcon(),
                category.isActive(),
                category.getModules().stream().map(this::toModuleRow).toList());
    }

    private PlatformDtos.PlatformModuleRow toModuleRow(PlatformModule module) {
        return new PlatformDtos.PlatformModuleRow(
                module.getId(),
                module.getModuleKey(),
                module.getLabel(),
                module.getDescription(),
                module.getNavSection(),
                module.getTier().name(),
                module.isLocked(),
                module.isPaidAddon(),
                module.getPricePerMonth(),
                module.isActive(),
                module.getSortOrder(),
                null,
                null,
                null);
    }

    private PlatformDtos.HotelModuleAuditRow toAuditRow(HotelModuleAuditLog row) {
        return new PlatformDtos.HotelModuleAuditRow(
                row.getId(),
                row.getHotelId(),
                row.getModuleKey(),
                row.getOldEnabled(),
                row.getNewEnabled(),
                row.getOldBilling(),
                row.getNewBilling(),
                row.getChangedBy(),
                row.getChangedAt(),
                row.getReason());
    }

    private UUID currentUserId() {
        return tenantAccessService.currentUser().getId();
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static ModuleTier parseEditableTier(String value) {
        String normalized = value.trim().toUpperCase();
        if ("DEFAULT".equals(normalized)) {
            return ModuleTier.DEFAULT;
        }
        if ("ADDON".equals(normalized)) {
            return ModuleTier.ADDON;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Module type must be standard or add-on.");
    }
}
