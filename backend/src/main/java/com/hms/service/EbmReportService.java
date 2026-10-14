package com.hms.service;

import com.hms.entity.DepotSale;
import com.hms.entity.DepotSaleLine;
import com.hms.entity.PurchaseOrder;
import com.hms.entity.TaxableSaleEvent;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.PurchaseOrderRepository;
import com.hms.repository.TaxableSaleEventRepository;
import com.hms.security.TenantAccessService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily X/Z fiscal summaries and PLU (item) report from CIS journal / POS sales.
 */
@Service
public class EbmReportService {

    private final TenantAccessService tenantAccessService;
    private final DepotSaleRepository depotSaleRepository;
    private final TaxableSaleEventRepository saleEventRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public EbmReportService(
            TenantAccessService tenantAccessService,
            DepotSaleRepository depotSaleRepository,
            TaxableSaleEventRepository saleEventRepository,
            PurchaseOrderRepository purchaseOrderRepository) {
        this.tenantAccessService = tenantAccessService;
        this.depotSaleRepository = depotSaleRepository;
        this.saleEventRepository = saleEventRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dailyXz(UUID hotelId, String hotelHeader, String type) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ZoneId zone = ZoneId.of("Africa/Kigali");
        Instant from = LocalDate.now(zone).atStartOfDay(zone).toInstant();
        Instant to = Instant.now();
        List<DepotSale> sales = depotSaleRepository.findSalesBetween(hotelId, from, to);
        BigDecimal cash = BigDecimal.ZERO;
        BigDecimal card = BigDecimal.ZERO;
        BigDecimal mobile = BigDecimal.ZERO;
        BigDecimal credit = BigDecimal.ZERO;
        BigDecimal other = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        int items = 0;
        for (DepotSale s : sales) {
            BigDecimal tot = s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO;
            String pmt = s.getPaymentMethod() != null ? s.getPaymentMethod().toUpperCase() : "CASH";
            switch (pmt) {
                case "CASH" -> cash = cash.add(tot);
                case "CARD", "CREDIT CARD", "BANK" -> card = card.add(tot);
                case "MOMO", "MOBILE", "MOBILE_MONEY" -> mobile = mobile.add(tot);
                case "CREDIT", "ROOM", "FOLIO" -> credit = credit.add(tot);
                default -> other = other.add(tot);
            }
            if (s.getLines() != null) {
                items += s.getLines().size();
                for (DepotSaleLine line : s.getLines()) {
                    if (line.isTaxable()) {
                        tax = tax.add(vatFromInclusive(line.getLineTotal()));
                    }
                }
            }
        }
        BigDecimal total = cash.add(card).add(mobile).add(credit).add(other);
        String kind = "Z".equalsIgnoreCase(type) ? "Z" : "X";
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("reportType", kind);
        out.put("label", kind.equals("Z") ? "Z REPORT (end of day)" : "X REPORT (period to date)");
        out.put("from", from.toString());
        out.put("to", to.toString());
        out.put("receiptCount", sales.size());
        out.put("itemCount", items);
        out.put("totalCash", scale2(cash));
        out.put("totalCard", scale2(card));
        out.put("totalMobile", scale2(mobile));
        out.put("totalCredit", scale2(credit));
        out.put("totalOther", scale2(other));
        out.put("totalSales", scale2(total));
        out.put("totalTax", scale2(tax));
        out.put("journalEvents", saleEventRepository.countByHotel_IdAndEbmStatus(hotelId, "ACKED"));
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> plu(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ZoneId zone = ZoneId.of("Africa/Kigali");
        Instant from = LocalDate.now(zone).atStartOfDay(zone).toInstant();
        List<DepotSale> sales = depotSaleRepository.findSalesBetween(hotelId, from, Instant.now());
        Map<String, Map<String, Object>> byItem = new LinkedHashMap<>();
        for (DepotSale s : sales) {
            if (s.getLines() == null) {
                continue;
            }
            for (DepotSaleLine line : s.getLines()) {
                String code = line.getProduct() != null && line.getProduct().getProductCode() != null
                        ? line.getProduct().getProductCode()
                        : "UNKNOWN";
                Map<String, Object> row = byItem.computeIfAbsent(code, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("itemCd", code);
                    m.put(
                            "itemNm",
                            line.getProduct() != null ? line.getProduct().getProductName() : "Item");
                    m.put("qty", BigDecimal.ZERO);
                    m.put("amount", BigDecimal.ZERO);
                    return m;
                });
                row.put("qty", bd(row.get("qty")).add(line.getQuantity() != null ? line.getQuantity() : BigDecimal.ZERO));
                row.put(
                        "amount",
                        bd(row.get("amount")).add(line.getLineTotal() != null ? line.getLineTotal() : BigDecimal.ZERO));
            }
        }
        List<Map<String, Object>> items = new ArrayList<>(byItem.values());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("reportType", "PLU");
        out.put("from", from.toString());
        out.put("itemCount", items.size());
        out.put("items", items);
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detailed(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ZoneId zone = ZoneId.of("Africa/Kigali");
        Instant from = LocalDate.now(zone).minusDays(30).atStartOfDay(zone).toInstant();
        List<TaxableSaleEvent> events =
                saleEventRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId, PageRequest.of(0, 200));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("salesJournal", events.size());
        out.put("posSales30d", depotSaleRepository.findSalesBetween(hotelId, from, Instant.now()).size());
        try {
            List<PurchaseOrder> pos = purchaseOrderRepository.findByHotel_IdOrderByOrderDateDesc(hotelId);
            out.put("purchases", pos.size());
        } catch (Exception ex) {
            out.put("purchases", 0);
        }
        out.put("note", "Stock, purchases and importation rows also appear under Settings → EBM code lists after VSDC sync.");
        return out;
    }

    private static BigDecimal vatFromInclusive(BigDecimal gross) {
        if (gross == null || gross.signum() == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal g = gross.setScale(2, RoundingMode.HALF_UP);
        BigDecimal net = g.divide(new BigDecimal("1.18"), 2, RoundingMode.HALF_UP);
        return g.subtract(net);
    }

    private static BigDecimal scale2(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal bd(Object v) {
        if (v instanceof BigDecimal b) {
            return b;
        }
        try {
            return new BigDecimal(String.valueOf(v));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
}
