package com.hms.service;

import com.hms.config.HmsEbmProperties;
import com.hms.entity.DepotSale;
import com.hms.entity.DepotSaleLine;
import com.hms.entity.EbmDevice;
import com.hms.entity.EbmOutboxEntry;
import com.hms.entity.FbOrder;
import com.hms.entity.InvSalesInvoice;
import com.hms.entity.InvSalesInvoiceItem;
import com.hms.entity.Invoice;
import com.hms.entity.InvoiceLineItem;
import com.hms.entity.TaxableSaleEvent;
import com.hms.repository.EbmOutboxRepository;
import com.hms.repository.TaxableSaleEventRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Emits TaxableSaleEvent + ordered outbox chain (TRANSACTION → INVOICE → STOCK_IO → STOCK_MASTER).
 * No-ops when EBM is disabled or hotel has no ACTIVE device.
 */
@Service
public class EbmSaleEventService {

    private static final Logger log = LoggerFactory.getLogger(EbmSaleEventService.class);

    private final HmsEbmProperties properties;
    private final EbmDeviceService deviceService;
    private final TaxableSaleEventRepository saleEventRepository;
    private final EbmOutboxRepository outboxRepository;
    private final EbmItemCdService itemCdService;

    public EbmSaleEventService(
            HmsEbmProperties properties,
            EbmDeviceService deviceService,
            TaxableSaleEventRepository saleEventRepository,
            EbmOutboxRepository outboxRepository,
            EbmItemCdService itemCdService) {
        this.properties = properties;
        this.deviceService = deviceService;
        this.saleEventRepository = saleEventRepository;
        this.outboxRepository = outboxRepository;
        this.itemCdService = itemCdService;
    }

    @Transactional
    public void enqueueDepotSale(UUID hotelId, DepotSale sale) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("DEPOT_SALE", sale.getId()).isPresent()) {
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        List<Map<String, Object>> lines = new ArrayList<>();
        for (DepotSaleLine line : sale.getLines()) {
            String itemCd = resolveDepotItemCd(line);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemCd", itemCd);
            row.put("itemNm", line.getProduct().getProductName());
            row.put("qty", line.getQuantity());
            row.put("prc", line.getUnitPrice());
            row.put("splyAmt", line.getLineTotal());
            row.put("taxblYn", line.isTaxable() ? "Y" : "N");
            row.put("taxTyCd", line.isTaxable() ? "B" : "A");
            lines.add(row);
        }
        Map<String, Object> payload = baseSalePayload(
                device, sale.getSaleNumber(), sale.getTotalAmount(), lines, sale.getPaymentMethod());
        createChain(hotelId, device, "DEPOT_SALE", sale.getId(), sale.getSaleNumber(), payload, true);
    }

    @Transactional
    public void enqueueInvSalesInvoice(UUID hotelId, InvSalesInvoice inv) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("INV_SALES_INVOICE", inv.getId()).isPresent()) {
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        List<Map<String, Object>> lines = new ArrayList<>();
        for (InvSalesInvoiceItem li : inv.getItems()) {
            if (li.getItem() != null) {
                itemCdService.ensureItemCd(li.getItem());
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemCd", li.getItem() != null ? li.getItem().getItemCd() : "UNKNOWN");
            row.put("itemNm", li.getItemName() != null ? li.getItemName() : "Item");
            row.put("qty", li.getQuantity());
            row.put("prc", li.getUnitPrice());
            row.put("splyAmt", li.getSubtotal());
            row.put("taxTyCd", li.getItem() != null ? li.getItem().getTaxCategory() : "B");
            lines.add(row);
        }
        Map<String, Object> payload = baseSalePayload(
                device, inv.getInvoiceNumber(), inv.getTotalAmount(), lines, inv.getPaymentMethod());
        createChain(hotelId, device, "INV_SALES_INVOICE", inv.getId(), inv.getInvoiceNumber(), payload, true);
    }

    @Transactional
    public void enqueueHotelInvoice(UUID hotelId, Invoice inv) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("INVOICE", inv.getId()).isPresent()) {
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        List<Map<String, Object>> lines = new ArrayList<>();
        if (inv.getLineItems() != null) {
            int i = 0;
            for (InvoiceLineItem li : inv.getLineItems()) {
                i++;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("itemCd", "SVC" + String.format("%07d", i));
                row.put("itemNm", li.getDescription() != null ? li.getDescription() : "Charge");
                row.put("qty", BigDecimal.ONE);
                row.put("prc", li.getAmount());
                row.put("splyAmt", li.getAmount());
                row.put("taxTyCd", "B");
                lines.add(row);
            }
        }
        Map<String, Object> payload = baseSalePayload(
                device, inv.getInvoiceNumber(), inv.getTotalAmount(), lines, null);
        createChain(hotelId, device, "INVOICE", inv.getId(), inv.getInvoiceNumber(), payload, false);
    }

    @Transactional
    public void enqueueFbOrder(UUID hotelId, FbOrder order) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("FB_ORDER", order.getId()).isPresent()) {
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        List<Map<String, Object>> lines = new ArrayList<>();
        if (order.getLines() != null) {
            int i = 0;
            for (var li : order.getLines()) {
                i++;
                String name = li.getMenuItem() != null ? li.getMenuItem().getName() : "F&B item";
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("itemCd", "FB" + String.format("%07d", i));
                row.put("itemNm", name);
                row.put("qty", BigDecimal.valueOf(li.getQuantity()));
                row.put("prc", li.getUnitPrice());
                row.put("splyAmt", li.getLineTotal());
                row.put("taxTyCd", "B");
                lines.add(row);
            }
        }
        String pay = order.getPaymentStatus() != null ? order.getPaymentStatus().name() : null;
        Map<String, Object> payload = baseSalePayload(
                device, order.getOrderNumber(), order.getTotal(), lines, pay);
        createChain(hotelId, device, "FB_ORDER", order.getId(), order.getOrderNumber(), payload, true);
    }

    private boolean canEnqueue(UUID hotelId) {
        if (!properties.isEnabled()) {
            return false;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        if (device == null) {
            log.debug("EBM skip enqueue hotel={} — no ACTIVE device", hotelId);
            return false;
        }
        return true;
    }

    private String resolveDepotItemCd(DepotSaleLine line) {
        var product = line.getProduct();
        if (product.getInventoryItem() != null) {
            itemCdService.ensureItemCd(product.getInventoryItem());
            if (product.getItemCd() == null) {
                product.setItemCd(product.getInventoryItem().getItemCd());
            }
            return product.getInventoryItem().getItemCd();
        }
        if (product.getItemCd() != null && !product.getItemCd().isBlank()) {
            return product.getItemCd();
        }
        String allocated = itemCdService.allocateItemCd(
                product.getHotel().getId(),
                product.getItemTyCd(),
                product.getPkgUnitCd(),
                product.getQtyUnitCd());
        product.setItemCd(allocated);
        return allocated;
    }

    private Map<String, Object> baseSalePayload(
            EbmDevice device,
            String docNo,
            BigDecimal total,
            List<Map<String, Object>> lines,
            String paymentMethod) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tin", device.getTin());
        payload.put("bhfId", device.getBranchId());
        payload.put("invcNo", docNo);
        payload.put("salesTyCd", "N");
        payload.put("rcptTyCd", "S");
        payload.put("pmtTyCd", mapPayment(paymentMethod));
        payload.put("salesSttsCd", "02");
        payload.put("cfmDt", Instant.now().toString());
        payload.put("totAmt", total);
        payload.put("itemList", lines);
        return payload;
    }

    private void createChain(
            UUID hotelId,
            EbmDevice device,
            String sourceType,
            UUID sourceId,
            String documentNumber,
            Map<String, Object> salePayload,
            boolean includeStock) {
        TaxableSaleEvent event = new TaxableSaleEvent();
        event.setHotel(device.getHotel());
        event.setDevice(device);
        event.setSourceType(sourceType);
        event.setSourceId(sourceId);
        event.setDocumentNumber(documentNumber);
        event.setEbmStatus("PENDING");
        event = saleEventRepository.save(event);

        EbmOutboxEntry tx = outbox(device, event, "TRANSACTION", null, withPhase(salePayload, "TRANSACTION"));
        tx = outboxRepository.save(tx);

        EbmOutboxEntry inv = outbox(device, event, "INVOICE", tx, withPhase(salePayload, "INVOICE"));
        inv = outboxRepository.save(inv);

        if (includeStock) {
            Map<String, Object> stockPayload = new LinkedHashMap<>();
            stockPayload.put("tin", device.getTin());
            stockPayload.put("bhfId", device.getBranchId());
            stockPayload.put("sarNo", documentNumber);
            stockPayload.put("itemList", salePayload.get("itemList"));
            EbmOutboxEntry stockIo = outbox(device, event, "STOCK_IO", inv, withPhase(stockPayload, "STOCK_IO"));
            stockIo = outboxRepository.save(stockIo);

            Map<String, Object> masterPayload = new LinkedHashMap<>();
            masterPayload.put("tin", device.getTin());
            masterPayload.put("bhfId", device.getBranchId());
            masterPayload.put("itemList", salePayload.get("itemList"));
            outboxRepository.save(outbox(device, event, "STOCK_MASTER", stockIo, withPhase(masterPayload, "STOCK_MASTER")));
        }

        log.info("EBM enqueued {} {} doc={} hotel={}", sourceType, sourceId, documentNumber, hotelId);
    }

    private static Map<String, Object> withPhase(Map<String, Object> base, String phase) {
        Map<String, Object> copy = new LinkedHashMap<>(base);
        copy.put("_phase", phase);
        return copy;
    }

    private static EbmOutboxEntry outbox(
            EbmDevice device, TaxableSaleEvent event, String phase, EbmOutboxEntry dependsOn, Map<String, Object> payload) {
        EbmOutboxEntry e = new EbmOutboxEntry();
        e.setDevice(device);
        e.setSaleEvent(event);
        e.setPhase(phase);
        e.setStatus("PENDING");
        e.setDependsOn(dependsOn);
        e.setPayload(payload);
        return e;
    }

    private static String mapPayment(String method) {
        if (method == null) {
            return "01";
        }
        return switch (method.trim().toUpperCase()) {
            case "CASH" -> "01";
            case "CARD", "CREDIT_CARD", "DEBIT_CARD" -> "02";
            case "MOBILE", "MOMO", "MTN", "AIRTEL" -> "03";
            case "CREDIT", "ROOM", "CHARGE_TO_ROOM" -> "04";
            default -> "01";
        };
    }
}
