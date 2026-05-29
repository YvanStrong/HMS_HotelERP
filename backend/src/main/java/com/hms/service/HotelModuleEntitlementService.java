package com.hms.service;

import com.hms.api.dto.PlatformDtos;
import com.hms.domain.ModuleBillingStatus;
import com.hms.domain.ModuleTier;
import com.hms.entity.*;
import com.hms.repository.*;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("moduleEntitlement")
public class HotelModuleEntitlementService {

    private static final Map<String, List<String>> DEPENDENCIES = Map.of(
            "PMS", List.of("ROOMS"),
            "HOUSEKEEPING", List.of("ROOMS"),
            "HK_MY_TASKS", List.of("HOUSEKEEPING"),
            "ROOM_BLOCKS", List.of("ROOMS"),
            "ROOM_TYPES", List.of("ROOMS"),
            "GROUPS_EVENTS", List.of("PMS"),
            "REVENUE_CHANNELS", List.of("ROOMS", "PMS"),
            "PRICING", List.of("ROOMS", "PMS"));

    private final PlatformModuleRepository moduleRepository;
    private final PlatformBusinessCategoryRepository categoryRepository;
    private final HotelModuleEntitlementRepository entitlementRepository;
    private final HotelModuleAuditLogRepository auditLogRepository;
    private final HotelRepository hotelRepository;
    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;
    private final FbOrderRepository fbOrderRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final FacilityRepository facilityRepository;

    public HotelModuleEntitlementService(
            PlatformModuleRepository moduleRepository,
            PlatformBusinessCategoryRepository categoryRepository,
            HotelModuleEntitlementRepository entitlementRepository,
            HotelModuleAuditLogRepository auditLogRepository,
            HotelRepository hotelRepository,
            RoomRepository roomRepository,
            ReservationRepository reservationRepository,
            FbOrderRepository fbOrderRepository,
            InventoryItemRepository inventoryItemRepository,
            FacilityRepository facilityRepository) {
        this.moduleRepository = moduleRepository;
        this.categoryRepository = categoryRepository;
        this.entitlementRepository = entitlementRepository;
        this.auditLogRepository = auditLogRepository;
        this.hotelRepository = hotelRepository;
        this.roomRepository = roomRepository;
        this.reservationRepository = reservationRepository;
        this.fbOrderRepository = fbOrderRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.facilityRepository = facilityRepository;
    }

    @Transactional(readOnly = true)
    public Set<String> resolveEnabledModules(UUID hotelId) {
        Set<String> keys = moduleRepository.findByLocked(true).stream()
                .filter(PlatformModule::isActive)
                .map(PlatformModule::getModuleKey)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (HotelModuleEntitlement entitlement : entitlementRepository.findByHotelIdAndEnabled(hotelId, true)) {
            if (entitlement.getModule().isActive() && entitlement.getBillingStatus() != ModuleBillingStatus.SUSPENDED) {
                keys.add(entitlement.getModule().getModuleKey());
            }
        }
        return keys;
    }

    @Transactional(readOnly = true)
    public Set<String> resolveVisibleDisabledModules(UUID hotelId) {
        return entitlementRepository.findByHotelId(hotelId).stream()
                .filter(entitlement ->
                        entitlement.getModule().isActive() && !entitlement.isEnabled() && entitlement.isShowWhenDisabled())
                .map(entitlement -> entitlement.getModule().getModuleKey())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    @Transactional(readOnly = true)
    public boolean hasModule(UUID hotelId, String moduleKey) {
        PlatformModule module = findModule(moduleKey);
        if (!module.isActive()) {
            return false;
        }
        if (module.isLocked()) {
            return true;
        }
        return entitlementRepository.existsByHotelIdAndModuleKeyAndEnabled(hotelId, module.getModuleKey(), true);
    }

    @Transactional(readOnly = true)
    public PlatformDtos.HotelModuleEntitlementsResponse getEntitlementsForHotel(UUID hotelId) {
        Map<String, HotelModuleEntitlement> entitlements = entitlementRepository.findByHotelId(hotelId).stream()
                .collect(Collectors.toMap(e -> e.getModule().getModuleKey(), e -> e));
        List<PlatformDtos.PlatformModuleRow> core = new ArrayList<>();
        List<PlatformDtos.PlatformModuleRow> enabled = new ArrayList<>();
        List<PlatformDtos.PlatformModuleRow> disabled = new ArrayList<>();
        List<PlatformDtos.PlatformModuleRow> addons = new ArrayList<>();
        Set<String> enabledKeys = new LinkedHashSet<>();
        for (PlatformModule module : moduleRepository.findAllByActiveTrueOrderBySortOrderAsc()) {
            HotelModuleEntitlement entitlement = entitlements.get(module.getModuleKey());
            boolean moduleEnabled = module.isLocked()
                    || (entitlement != null
                            && entitlement.isEnabled()
                            && entitlement.getBillingStatus() != ModuleBillingStatus.SUSPENDED);
            PlatformDtos.PlatformModuleRow row = toModuleRow(module, entitlement, moduleEnabled);
            if (moduleEnabled) {
                enabledKeys.add(module.getModuleKey());
            }
            if (module.isLocked()) {
                core.add(row);
            } else if (module.getTier() == ModuleTier.ADDON && !moduleEnabled) {
                addons.add(row);
            } else if (moduleEnabled) {
                enabled.add(row);
            } else {
                disabled.add(row);
            }
        }
        return new PlatformDtos.HotelModuleEntitlementsResponse(core, enabled, disabled, addons, List.copyOf(enabledKeys));
    }

    @Transactional
    public PlatformDtos.HotelModuleEntitlementsResponse applyCategory(UUID hotelId, UUID categoryId, UUID changedBy) {
        Hotel hotel = mustHotel(hotelId);
        PlatformBusinessCategory category = categoryRepository
                .findByIdWithModules(categoryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Business category not found"));
        Map<String, HotelModuleEntitlement> old = entitlementRepository.findByHotelId(hotelId).stream()
                .collect(Collectors.toMap(e -> e.getModule().getModuleKey(), e -> e));
        entitlementRepository.deleteNonCoreNonAddonByHotelId(hotelId);
        hotel.setBusinessCategory(category);
        hotelRepository.save(hotel);
        Set<String> defaultKeys = category.getModules().stream()
                .filter(module -> !module.isLocked() && module.getTier() != ModuleTier.ADDON)
                .map(PlatformModule::getModuleKey)
                .collect(Collectors.toSet());
        for (PlatformModule module : category.getModules()) {
            if (!module.isLocked() && module.getTier() != ModuleTier.ADDON) {
                upsertEntitlement(
                        hotel, module, true, false, ModuleBillingStatus.INCLUDED, changedBy, "Applied category " + category.getCode());
            }
        }
        for (Map.Entry<String, HotelModuleEntitlement> entry : old.entrySet()) {
            HotelModuleEntitlement previous = entry.getValue();
            if (previous.getModule().getTier() != ModuleTier.ADDON && !defaultKeys.contains(entry.getKey())) {
                audit(hotelId, entry.getKey(), previous.isEnabled(), false, previous.getBillingStatus(), ModuleBillingStatus.INCLUDED, changedBy, "Applied category " + category.getCode());
            }
        }
        return getEntitlementsForHotel(hotelId);
    }

    @Transactional
    public PlatformDtos.UpdateModuleEntitlementResponse updateModuleEntitlement(
            UUID hotelId,
            String moduleKey,
            boolean enabled,
            Boolean showWhenDisabled,
            String billingStatus,
            UUID changedBy,
            String reason) {
        PlatformModule module = findModule(moduleKey);
        if (module.isLocked()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MODULE_LOCKED", "Core modules cannot be disabled.");
        }
        ModuleBillingStatus status = parseBillingStatus(billingStatus, ModuleBillingStatus.INCLUDED);
        List<String> cascade = new ArrayList<>();
        if (!enabled) {
            disableModule(hotelId, module.getModuleKey(), Boolean.TRUE.equals(showWhenDisabled), changedBy, reason, cascade);
        } else {
            upsertEntitlement(mustHotel(hotelId), module, true, false, status, changedBy, reason);
        }
        return new PlatformDtos.UpdateModuleEntitlementResponse(getEntitlementsForHotel(hotelId), cascade);
    }

    @Transactional
    public PlatformDtos.HotelModuleEntitlementsResponse activateAddon(
            UUID hotelId, String moduleKey, String billingStatus, UUID changedBy) {
        PlatformModule module = findModule(moduleKey);
        if (module.getTier() != ModuleTier.ADDON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Module is not a paid add-on.");
        }
        ModuleBillingStatus status = parseBillingStatus(billingStatus, ModuleBillingStatus.ADDON);
        if (status != ModuleBillingStatus.ADDON && status != ModuleBillingStatus.TRIAL) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Addon billing status must be addon or trial.");
        }
        HotelModuleEntitlement entitlement =
                upsertEntitlement(mustHotel(hotelId), module, true, false, status, changedBy, "Activated add-on");
        entitlement.setAddonActivatedAt(Instant.now());
        entitlementRepository.save(entitlement);
        return getEntitlementsForHotel(hotelId);
    }

    @Transactional
    public PlatformDtos.HotelModuleEntitlementsResponse deactivateAddon(UUID hotelId, String moduleKey, UUID changedBy) {
        PlatformModule module = findModule(moduleKey);
        if (module.getTier() != ModuleTier.ADDON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Module is not a paid add-on.");
        }
        disableModule(hotelId, module.getModuleKey(), false, changedBy, "Deactivated add-on", new ArrayList<>());
        return getEntitlementsForHotel(hotelId);
    }

    private void disableModule(
            UUID hotelId,
            String moduleKey,
            boolean showWhenDisabled,
            UUID changedBy,
            String reason,
            List<String> cascade) {
        PlatformModule module = findModule(moduleKey);
        HotelModuleEntitlement entitlement = entitlementRepository
                .findByHotelIdAndModuleKey(hotelId, module.getModuleKey())
                .orElse(null);
        boolean disabledNow = false;
        if (entitlement == null && showWhenDisabled) {
            entitlement = new HotelModuleEntitlement();
            entitlement.setHotel(mustHotel(hotelId));
            entitlement.setModule(module);
            entitlement.getId().setHotelId(hotelId);
            entitlement.getId().setModuleId(module.getId());
            entitlement.setEnabled(false);
            entitlement.setShowWhenDisabled(true);
            entitlement.setBillingStatus(ModuleBillingStatus.INCLUDED);
            entitlement.setDisabledAt(Instant.now());
            entitlementRepository.save(entitlement);
            audit(
                    hotelId,
                    module.getModuleKey(),
                    null,
                    false,
                    null,
                    ModuleBillingStatus.INCLUDED,
                    changedBy,
                    reason);
        }
        if (entitlement != null && entitlement.isEnabled()) {
            assertCanDisable(hotelId, module.getModuleKey());
            audit(
                    hotelId,
                    module.getModuleKey(),
                    true,
                    false,
                    entitlement.getBillingStatus(),
                    ModuleBillingStatus.INCLUDED,
                    changedBy,
                    reason);
            entitlement.setEnabled(false);
            entitlement.setShowWhenDisabled(showWhenDisabled);
            entitlement.setBillingStatus(ModuleBillingStatus.INCLUDED);
            entitlement.setDisabledAt(Instant.now());
            entitlementRepository.save(entitlement);
            disabledNow = true;
        } else if (entitlement != null && entitlement.isShowWhenDisabled() != showWhenDisabled) {
            entitlement.setShowWhenDisabled(showWhenDisabled);
            entitlementRepository.save(entitlement);
            audit(
                    hotelId,
                    module.getModuleKey(),
                    false,
                    false,
                    entitlement.getBillingStatus(),
                    entitlement.getBillingStatus(),
                    changedBy,
                    reason);
        }
        if (!disabledNow) {
            return;
        }
        for (String dependent : dependentsOf(moduleKey)) {
            if (hasModule(hotelId, dependent)) {
                cascade.add(dependent);
                disableModule(
                        hotelId,
                        dependent,
                        showWhenDisabled,
                        changedBy,
                        "Cascade disabled because " + moduleKey + " was disabled",
                        cascade);
            }
        }
    }

    private HotelModuleEntitlement upsertEntitlement(
            Hotel hotel,
            PlatformModule module,
            boolean enabled,
            boolean showWhenDisabled,
            ModuleBillingStatus billingStatus,
            UUID changedBy,
            String reason) {
        HotelModuleEntitlement entitlement = entitlementRepository
                .findByHotelIdAndModuleKey(hotel.getId(), module.getModuleKey())
                .orElseGet(() -> {
                    HotelModuleEntitlement created = new HotelModuleEntitlement();
                    created.setHotel(hotel);
                    created.setModule(module);
                    created.getId().setHotelId(hotel.getId());
                    created.getId().setModuleId(module.getId());
                    return created;
                });
        audit(hotel.getId(), module.getModuleKey(), entitlement.isEnabled(), enabled, entitlement.getBillingStatus(), billingStatus, changedBy, reason);
        entitlement.setEnabled(enabled);
        entitlement.setShowWhenDisabled(showWhenDisabled);
        entitlement.setBillingStatus(billingStatus);
        if (enabled) {
            entitlement.setEnabledAt(Instant.now());
            entitlement.setDisabledAt(null);
        } else {
            entitlement.setDisabledAt(Instant.now());
        }
        return entitlementRepository.save(entitlement);
    }

    private void assertCanDisable(UUID hotelId, String moduleKey) {
        long count = switch (moduleKey) {
            case "ROOMS" -> roomRepository.countByHotel_Id(hotelId);
            case "PMS" -> reservationRepository.countFutureByHotelId(hotelId);
            case "RESTAURANT_POS" -> fbOrderRepository.countByHotelId(hotelId);
            case "INVENTORY" -> inventoryItemRepository.countByHotel_IdAndActiveTrue(hotelId);
            case "FACILITIES" -> facilityRepository.countByHotel_Id(hotelId);
            default -> 0L;
        };
        if (count > 0) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "MODULE_HAS_ACTIVE_DATA",
                    "Cannot disable " + moduleKey + ": " + count + " active records exist. Archive or delete them first.");
        }
    }

    private List<String> dependentsOf(String moduleKey) {
        return DEPENDENCIES.entrySet().stream()
                .filter(entry -> entry.getValue().contains(moduleKey))
                .map(Map.Entry::getKey)
                .toList();
    }

    private void audit(
            UUID hotelId,
            String moduleKey,
            Boolean oldEnabled,
            Boolean newEnabled,
            ModuleBillingStatus oldBilling,
            ModuleBillingStatus newBilling,
            UUID changedBy,
            String reason) {
        HotelModuleAuditLog log = new HotelModuleAuditLog();
        log.setHotelId(hotelId);
        log.setModuleKey(moduleKey);
        log.setOldEnabled(oldEnabled);
        log.setNewEnabled(newEnabled);
        log.setOldBilling(oldBilling != null ? oldBilling.name().toLowerCase() : null);
        log.setNewBilling(newBilling != null ? newBilling.name().toLowerCase() : null);
        log.setChangedBy(changedBy);
        log.setReason(reason);
        auditLogRepository.save(log);
    }

    private PlatformDtos.PlatformModuleRow toModuleRow(
            PlatformModule module, HotelModuleEntitlement entitlement, boolean enabled) {
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
                enabled,
                entitlement != null ? entitlement.isShowWhenDisabled() : false,
                entitlement != null && entitlement.getBillingStatus() != null
                        ? entitlement.getBillingStatus().name().toLowerCase()
                        : null);
    }

    private PlatformModule findModule(String moduleKey) {
        return moduleRepository
                .findByModuleKey(moduleKey.trim().toUpperCase())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Module not found"));
    }

    private Hotel mustHotel(UUID hotelId) {
        return hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
    }

    private ModuleBillingStatus parseBillingStatus(String value, ModuleBillingStatus fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return ModuleBillingStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid module billing status");
        }
    }
}
