package com.hms.service;

import com.hms.api.dto.InventoryDepotDtos;
import com.hms.domain.DepotType;
import com.hms.entity.DepotProduct;
import com.hms.entity.DepotSale;
import com.hms.entity.DepotSaleLine;
import com.hms.entity.Hotel;
import com.hms.entity.InventoryDepot;
import com.hms.entity.InventoryItem;
import com.hms.repository.DepotProductRepository;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryDepotService {

    private static final List<DepotSeed> DEFAULT_DEPOTS = List.of(
            new DepotSeed("Restaurant", "REST", DepotType.RESTAURANT),
            new DepotSeed("Bar", "BAR", DepotType.BAR),
            new DepotSeed("Cuisine", "CUIS", DepotType.CUISINE),
            new DepotSeed("Principal", "PRINC", DepotType.PRINCIPAL),
            new DepotSeed("Barista", "BARISTA", DepotType.BARISTA),
            new DepotSeed("Patisry", "PAT", DepotType.PATISSERIE));

    private final TenantAccessService tenantAccessService;
    private final InventoryDepotRepository inventoryDepotRepository;
    private final DepotProductRepository depotProductRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final HotelRepository hotelRepository;
    private final InventoryItemRepository inventoryItemRepository;

    public InventoryDepotService(
            TenantAccessService tenantAccessService,
            InventoryDepotRepository inventoryDepotRepository,
            DepotProductRepository depotProductRepository,
            DepotSaleRepository depotSaleRepository,
            HotelRepository hotelRepository,
            InventoryItemRepository inventoryItemRepository) {
        this.tenantAccessService = tenantAccessService;
        this.inventoryDepotRepository = inventoryDepotRepository;
        this.depotProductRepository = depotProductRepository;
        this.depotSaleRepository = depotSaleRepository;
        this.hotelRepository = hotelRepository;
        this.inventoryItemRepository = inventoryItemRepository;
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.DepotRow> listDepots(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return inventoryDepotRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(this::toRow)
                .toList();
    }

    @Transactional
    public List<InventoryDepotDtos.DepotRow> bootstrapDefaults(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        for (DepotSeed seed : DEFAULT_DEPOTS) {
            if (inventoryDepotRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, seed.code())) {
                continue;
            }
            InventoryDepot d = new InventoryDepot();
            d.setHotel(hotel);
            d.setName(seed.name());
            d.setCode(seed.code());
            d.setDepotType(seed.type());
            inventoryDepotRepository.save(d);
        }
        return listDepots(hotelId, hotelHeader);
    }

    @Transactional
    public InventoryDepotDtos.CreateDepotResponse createDepot(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateDepotRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String code = (req.code() == null || req.code().isBlank()) ? normalizeCode(req.name()) : normalizeCode(req.code());
        if (inventoryDepotRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Depot code already exists: " + code);
        }
        InventoryDepot d = new InventoryDepot();
        d.setHotel(hotel);
        d.setName(req.name().trim());
        d.setCode(code);
        d.setDepotType(parseDepotType(req.depotType()));
        d = inventoryDepotRepository.save(d);
        return new InventoryDepotDtos.CreateDepotResponse(
                d.getId(), d.getName(), d.getCode(), d.getDepotType().name(), "Depot created");
    }

    @Transactional
    public InventoryDepotDtos.CreateDepotProductResponse createProduct(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateDepotProductRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));

        String cleanName = req.productName().trim();
        int nextNumber = depotProductRepository.findMaxProductNumber(hotelId) + 1;
        String code = nextProductCode(hotelId, cleanName);

        DepotProduct p = new DepotProduct();
        p.setHotel(hotel);
        p.setDepot(depot);
        p.setProductNumber(nextNumber);
        p.setProductName(cleanName);
        p.setProductCode(code);
        p.setBatchNo(req.batchNo() == null || req.batchNo().isBlank() ? "NA" : req.batchNo().trim());
        p.setExpiryDate(req.expiryDate());
        p.setCostPrice(scale2(req.costPrice()));
        p.setSellingPrice(scale2(req.sellingPrice()));
        String stockType = parseStockType(req.stockType());
        p.setStockType(stockType);
        if ("NON_STOCK".equals(stockType)) {
            p.setStockQty(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));
        } else {
            p.setStockQty(req.stockQty() == null ? BigDecimal.ZERO : req.stockQty().setScale(3, RoundingMode.HALF_UP));
        }
        p.setPhotoUrl(req.photoUrl());
        p.setMenuName(normalizeMenuName(req.menuName()));
        p.setTaxable(req.taxable() == null || Boolean.TRUE.equals(req.taxable()));
        if (req.inventoryItemId() != null) {
            InventoryItem ii = inventoryItemRepository
                    .findByIdAndHotel_Id(req.inventoryItemId(), hotelId)
                    .orElseThrow(() -> notFound("Inventory item"));
            p.setInventoryItem(ii);
        }
        p = depotProductRepository.save(p);
        return new InventoryDepotDtos.CreateDepotProductResponse(
                p.getId(), p.getProductNumber(), p.getProductCode(), "Depot product created", toProductRow(p));
    }

    @Transactional
    public InventoryDepotDtos.DepotProductRow patchProduct(
            UUID hotelId, String hotelHeader, UUID productId, InventoryDepotDtos.PatchDepotProductRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.productName() == null
                && req.batchNo() == null
                && req.expiryDate() == null
                && req.costPrice() == null
                && req.sellingPrice() == null
                && req.stockQty() == null
                && req.stockType() == null
                && req.photoUrl() == null
                && req.menuName() == null
                && req.taxable() == null
                && req.active() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provide at least one field to update");
        }
        DepotProduct p = depotProductRepository
                .findByIdAndHotel_Id(productId, hotelId)
                .orElseThrow(() -> notFound("Product"));
        if (req.productName() != null) {
            String name = req.productName().trim();
            if (name.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "productName cannot be blank");
            p.setProductName(name);
        }
        if (req.batchNo() != null) {
            p.setBatchNo(req.batchNo().isBlank() ? "NA" : req.batchNo().trim());
        }
        if (req.expiryDate() != null) {
            p.setExpiryDate(req.expiryDate());
        }
        if (req.costPrice() != null) {
            p.setCostPrice(scale2(req.costPrice()));
        }
        if (req.sellingPrice() != null) {
            p.setSellingPrice(scale2(req.sellingPrice()));
        }
        if (req.photoUrl() != null) {
            p.setPhotoUrl(req.photoUrl().isBlank() ? null : req.photoUrl().trim());
        }
        if (req.menuName() != null) {
            p.setMenuName(normalizeMenuName(req.menuName()));
        }
        if (req.taxable() != null) {
            p.setTaxable(req.taxable());
        }
        if (req.active() != null) {
            p.setActive(req.active());
        }
        if (req.stockType() != null && !req.stockType().isBlank()) {
            String stockType = parseStockType(req.stockType());
            p.setStockType(stockType);
            if ("NON_STOCK".equals(stockType)) {
                p.setStockQty(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));
            }
        }
        if (req.stockQty() != null) {
            if (!isManagedStockType(p.getStockType())) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "stockQty applies only to STOCK products; set stockType to STOCK first (or omit stockQty for NON_STOCK).");
            }
            p.setStockQty(req.stockQty().setScale(3, RoundingMode.HALF_UP));
        }
        p = depotProductRepository.save(p);
        return toProductRow(p);
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.DepotProductRow> listProducts(
            UUID hotelId, String hotelHeader, UUID depotId, String menuName, boolean activeOnly) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String menu = menuName != null && !menuName.isBlank() ? normalizeMenuName(menuName) : null;
        return depotProductRepository.search(hotelId, depotId, activeOnly).stream()
                .filter(p -> menu == null || menu.equalsIgnoreCase(p.getMenuName()))
                .map(this::toProductRow)
                .toList();
    }

    @Transactional
    public InventoryDepotDtos.CreateSaleResponse createSale(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateSaleRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));

        DepotSale sale = new DepotSale();
        sale.setHotel(hotel);
        sale.setDepot(depot);
        sale.setSaleNumber(nextSaleNumber(hotelId));
        sale.setCustomerName(req.customerName() == null ? null : req.customerName().trim());
        sale.setCreatedBy(tenantAccessService.currentUser().getUsername());

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        List<InventoryDepotDtos.SaleLineRow> responseLines = new ArrayList<>();

        for (InventoryDepotDtos.SaleLineInput line : req.lines()) {
            if (line.quantity() == null || line.quantity().signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be positive");
            }
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(line.productId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            if (!p.getDepot().getId().equals(depot.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product does not belong to selected depot");
            }
            boolean managedStock = isManagedStockType(p.getStockType());
            if (managedStock && p.getStockQty().compareTo(line.quantity()) < 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + p.getProductCode());
            }
            BigDecimal unitPrice = scale2(p.getSellingPrice());
            BigDecimal lineTotal = scale2(unitPrice.multiply(line.quantity()));
            total = total.add(lineTotal);

            DepotSaleLine sl = new DepotSaleLine();
            sl.setSale(sale);
            sl.setProduct(p);
            sl.setLineOrder(lineOrder++);
            sl.setQuantity(line.quantity().setScale(3, RoundingMode.HALF_UP));
            sl.setUnitPrice(unitPrice);
            sl.setLineTotal(lineTotal);
            sl.setTaxable(p.isTaxable());
            sale.getLines().add(sl);

            if (managedStock) {
                p.setStockQty(p.getStockQty().subtract(line.quantity()).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(p);
            }

            responseLines.add(new InventoryDepotDtos.SaleLineRow(
                    p.getProductName(),
                    p.getProductCode(),
                    sl.getQuantity(),
                    sl.getUnitPrice(),
                    sl.getLineTotal(),
                    sl.isTaxable()));
        }
        sale.setTotalAmount(scale2(total));
        sale = depotSaleRepository.save(sale);
        return new InventoryDepotDtos.CreateSaleResponse(
                sale.getId(),
                sale.getSaleNumber(),
                depot.getId(),
                sale.getTotalAmount(),
                sale.getCreatedAt(),
                responseLines,
                "Sale completed");
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.SaleRow> listSales(UUID hotelId, String hotelHeader, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return depotSaleRepository.findByHotelId(hotelId, depotId).stream()
                .map(s -> new InventoryDepotDtos.SaleRow(
                        s.getId(),
                        s.getSaleNumber(),
                        s.getDepot().getName(),
                        s.getCustomerName(),
                        s.getTotalAmount(),
                        s.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryDepotDtos.SaleDetailResponse getSaleDetail(UUID hotelId, String hotelHeader, UUID saleId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        DepotSale sale = depotSaleRepository
                .findFetchedByIdAndHotelId(saleId, hotelId)
                .orElseThrow(() -> notFound("Sale"));
        List<InventoryDepotDtos.SaleLineRow> lineRows = sale.getLines().stream()
                .sorted(Comparator.comparing(DepotSaleLine::getLineOrder))
                .map(sl -> new InventoryDepotDtos.SaleLineRow(
                        sl.getProduct().getProductName(),
                        sl.getProduct().getProductCode(),
                        sl.getQuantity(),
                        sl.getUnitPrice(),
                        sl.getLineTotal(),
                        sl.isTaxable()))
                .toList();
        return new InventoryDepotDtos.SaleDetailResponse(
                sale.getId(),
                sale.getSaleNumber(),
                sale.getDepot().getName(),
                sale.getCustomerName(),
                sale.getTotalAmount(),
                sale.getCreatedAt(),
                lineRows);
    }

    private static String normalizeMenuName(String raw) {
        if (raw == null || raw.isBlank()) return "GENERAL";
        return raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private static BigDecimal scale2(BigDecimal n) {
        return n == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : n.setScale(2, RoundingMode.HALF_UP);
    }

    private InventoryDepotDtos.DepotRow toRow(InventoryDepot d) {
        return new InventoryDepotDtos.DepotRow(d.getId(), d.getName(), d.getCode(), d.getDepotType().name(), d.isActive());
    }

    private InventoryDepotDtos.DepotProductRow toProductRow(DepotProduct p) {
        return new InventoryDepotDtos.DepotProductRow(
                p.getId(),
                p.getDepot().getId(),
                p.getDepot().getName(),
                p.getProductNumber(),
                p.getProductName(),
                p.getProductCode(),
                p.getBatchNo(),
                p.getExpiryDate(),
                p.getCostPrice(),
                p.getSellingPrice(),
                p.getStockQty(),
                canonicalStockTypeForApi(p.getStockType()),
                p.getPhotoUrl(),
                p.getMenuName(),
                p.isTaxable(),
                p.isActive());
    }

    private String nextProductCode(UUID hotelId, String productName) {
        String prefix = prefixFromName(productName);
        List<DepotProduct> candidates = depotProductRepository.findByHotel_IdAndProductCodeStartingWithIgnoreCase(hotelId, prefix);
        int max = 0;
        for (DepotProduct p : candidates) {
            String code = p.getProductCode();
            if (code == null || code.length() <= prefix.length()) continue;
            String tail = code.substring(prefix.length());
            if (!tail.chars().allMatch(Character::isDigit)) continue;
            max = Math.max(max, Integer.parseInt(tail));
        }
        return prefix + String.format("%03d", max + 1);
    }

    private static String prefixFromName(String name) {
        String cleaned = name == null ? "" : name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (cleaned.isBlank()) return "PRD";
        if (cleaned.length() >= 3) return cleaned.substring(0, 3);
        return (cleaned + "XXX").substring(0, 3);
    }

    private static String normalizeCode(String raw) {
        String c = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "");
        if (c.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid code");
        return c;
    }

    private static String parseStockType(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        return canonicalStockType(raw);
    }

    /** Normalizes UI/API variants (e.g. "NON STOCK", "non-stock") to STOCK / NON_STOCK. */
    private static String canonicalStockType(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        throw new ApiException(HttpStatus.BAD_REQUEST, "stockType must be STOCK or NON_STOCK");
    }

    /** Read path: never throws; unknown values default to STOCK for stable API output. */
    private static String canonicalStockTypeForApi(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        return "STOCK";
    }

    private static boolean isManagedStockType(String raw) {
        return "STOCK".equals(canonicalStockTypeOrDefaultStock(raw));
    }

    /**
     * For sale checks: unknown/blank values are treated as non-managed so legacy rows are not
     * blocked if the column was missing or inconsistent; only explicit STOCK is quantity-managed.
     */
    private static String canonicalStockTypeOrDefaultStock(String raw) {
        if (raw == null || raw.isBlank()) return "NON_STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        return "NON_STOCK";
    }

    private static DepotType parseDepotType(String raw) {
        if (raw == null || raw.isBlank()) return DepotType.OTHER;
        String value = raw.trim().toUpperCase(Locale.ROOT);
        if ("PATISRY".equals(value) || "PASTRY".equals(value)) return DepotType.PATISSERIE;
        return DepotType.valueOf(value);
    }

    private String nextSaleNumber(UUID hotelId) {
        long next = depotSaleRepository.countByHotelId(hotelId) + 1;
        return "DS-" + Year.now().getValue() + "-" + String.format("%06d", next);
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }

    private record DepotSeed(String name, String code, DepotType type) {}
}
