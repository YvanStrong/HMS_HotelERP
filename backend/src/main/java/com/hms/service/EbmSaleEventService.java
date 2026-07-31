package com.hms.service;

import com.hms.config.HmsEbmProperties;
import com.hms.ebm.EbmTaxPayload;
import com.hms.entity.DepotSale;
import com.hms.entity.DepotSaleLine;
import com.hms.entity.DepotSaleRefund;
import com.hms.entity.EbmDevice;
import com.hms.entity.EbmOutboxEntry;
import com.hms.entity.FbOrder;
import com.hms.entity.InvSalesInvoice;
import com.hms.entity.InvSalesInvoiceItem;
import com.hms.entity.InventoryItem;
import com.hms.entity.Invoice;
import com.hms.entity.InvoiceLineItem;
import com.hms.entity.PurchaseOrder;
import com.hms.entity.PurchaseOrderLine;
import com.hms.entity.Supplier;
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
 * Emits TaxableSaleEvent + ordered outbox chain (TRANSACTION → INVOICE → STOCK_IO → STOCK_MASTER),
 * plus credit notes (refunds), purchases, and item-master saves.
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
        int seq = 0;
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
            if (line.getProduct().getItemClsCd() != null) {
                row.put("itemClsCd", line.getProduct().getItemClsCd());
            }
            if (line.getProduct().getPkgUnitCd() != null) {
                row.put("pkgUnitCd", line.getProduct().getPkgUnitCd());
            }
            if (line.getProduct().getQtyUnitCd() != null) {
                row.put("qtyUnitCd", line.getProduct().getQtyUnitCd());
            }
            EbmTaxPayload.enrichLine(row, ++seq, properties.getDefaultItemClsCd());
            lines.add(row);
        }
        Map<String, Object> payload = baseSalePayload(
                device,
                sale.getSaleNumber(),
                sale.getTotalAmount(),
                lines,
                sale.getPaymentMethod(),
                "S",
                "0",
                sale.getCustomerTin(),
                sale.getCustomerName());
        createChain(hotelId, device, "DEPOT_SALE", sale.getId(), sale.getSaleNumber(), payload, true);
    }

    @Transactional
    public void enqueueDepotRefund(UUID hotelId, DepotSale sale, DepotSaleRefund refund) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("DEPOT_REFUND", refund.getId()).isPresent()) {
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        String orgInvc = originalInvcNo(sale.getId(), sale.getSaleNumber());
        List<Map<String, Object>> lines = new ArrayList<>();
        int seq = 0;
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
            EbmTaxPayload.enrichLine(row, ++seq, properties.getDefaultItemClsCd());
            lines.add(row);
        }
        Map<String, Object> payload = baseSalePayload(
                device,
                refund.getRefundNumber(),
                refund.getRefundAmount(),
                lines,
                refund.getRefundMethod() != null ? refund.getRefundMethod() : sale.getPaymentMethod(),
                "R",
                orgInvc,
                sale.getCustomerTin(),
                sale.getCustomerName());
        payload.put("rfdRsnCd", "01");
        createChain(hotelId, device, "DEPOT_REFUND", refund.getId(), refund.getRefundNumber(), payload, true);
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
        List<Map<String, Object>> lines = buildInvInvoiceLines(inv);
        Map<String, Object> payload = baseSalePayload(
                device,
                inv.getInvoiceNumber(),
                inv.getTotalAmount(),
                lines,
                inv.getPaymentMethod(),
                "S",
                "0",
                null,
                inv.getCustomerName());
        createChain(hotelId, device, "INV_SALES_INVOICE", inv.getId(), inv.getInvoiceNumber(), payload, true);
    }

    @Transactional
    public void enqueueInvSalesReturn(UUID hotelId, InvSalesInvoice inv) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("INV_SALES_RETURN", inv.getId()).isPresent()) {
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        List<Map<String, Object>> lines = buildInvInvoiceLines(inv);
        String orgInvc = originalInvcNo(inv.getId(), inv.getInvoiceNumber());
        Map<String, Object> payload = baseSalePayload(
                device,
                inv.getInvoiceNumber() + "-R",
                inv.getTotalAmount(),
                lines,
                inv.getPaymentMethod(),
                "R",
                orgInvc,
                null,
                inv.getCustomerName());
        payload.put("rfdRsnCd", "01");
        createChain(hotelId, device, "INV_SALES_RETURN", inv.getId(), inv.getInvoiceNumber() + "-R", payload, true);
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
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("itemCd", "SVC" + String.format("%07d", ++i));
                row.put("itemNm", li.getDescription() != null ? li.getDescription() : "Charge");
                row.put("qty", BigDecimal.ONE);
                row.put("prc", li.getAmount());
                row.put("splyAmt", li.getAmount());
                row.put("taxTyCd", "B");
                EbmTaxPayload.enrichLine(row, i, properties.getDefaultItemClsCd());
                lines.add(row);
            }
        }
        String custNm = inv.getReservation() != null && inv.getReservation().getGuest() != null
                ? inv.getReservation().getGuest().getFullName()
                : null;
        Map<String, Object> payload = baseSalePayload(
                device, inv.getInvoiceNumber(), inv.getTotalAmount(), lines, null, "S", "0", null, custNm);
        createChain(hotelId, device, "INVOICE", inv.getId(), inv.getInvoiceNumber(), payload, false);
    }

    @Transactional
    public void enqueueHotelInvoiceRefund(UUID hotelId, Invoice inv, UUID refundId, String refundDocNo) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("INVOICE_REFUND", refundId).isPresent()) {
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        List<Map<String, Object>> lines = new ArrayList<>();
        if (inv.getLineItems() != null) {
            int i = 0;
            for (InvoiceLineItem li : inv.getLineItems()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("itemCd", "SVC" + String.format("%07d", ++i));
                row.put("itemNm", li.getDescription() != null ? li.getDescription() : "Charge");
                row.put("qty", BigDecimal.ONE);
                row.put("prc", li.getAmount());
                row.put("splyAmt", li.getAmount());
                row.put("taxTyCd", "B");
                EbmTaxPayload.enrichLine(row, i, properties.getDefaultItemClsCd());
                lines.add(row);
            }
        }
        String orgInvc = originalInvcNo(inv.getId(), inv.getInvoiceNumber());
        String custNm = inv.getReservation() != null && inv.getReservation().getGuest() != null
                ? inv.getReservation().getGuest().getFullName()
                : null;
        Map<String, Object> payload = baseSalePayload(
                device,
                refundDocNo != null ? refundDocNo : inv.getInvoiceNumber() + "-R",
                inv.getTotalAmount(),
                lines,
                null,
                "R",
                orgInvc,
                null,
                custNm);
        payload.put("rfdRsnCd", "01");
        createChain(
                hotelId,
                device,
                "INVOICE_REFUND",
                refundId,
                refundDocNo != null ? refundDocNo : inv.getInvoiceNumber() + "-R",
                payload,
                false);
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
                String name = li.getMenuItem() != null ? li.getMenuItem().getName() : "F&B item";
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("itemCd", "FB" + String.format("%07d", ++i));
                row.put("itemNm", name);
                row.put("qty", BigDecimal.valueOf(li.getQuantity()));
                row.put("prc", li.getUnitPrice());
                row.put("splyAmt", li.getLineTotal());
                row.put("taxTyCd", "B");
                EbmTaxPayload.enrichLine(row, i, properties.getDefaultItemClsCd());
                lines.add(row);
            }
        }
        String pay = order.getPaymentStatus() != null ? order.getPaymentStatus().name() : null;
        Map<String, Object> payload = baseSalePayload(
                device, order.getOrderNumber(), order.getTotal(), lines, pay, "S", "0", null, null);
        createChain(hotelId, device, "FB_ORDER", order.getId(), order.getOrderNumber(), payload, true);
    }

    @Transactional
    public void enqueuePurchaseReceive(UUID hotelId, PurchaseOrder po) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        if (saleEventRepository.findBySourceTypeAndSourceId("PURCHASE_RECEIVE", po.getId()).isPresent()) {
            // Allow re-enqueue only if not already confirmed — skip duplicate for simplicity
            return;
        }
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        List<Map<String, Object>> lines = new ArrayList<>();
        int seq = 0;
        BigDecimal tot = BigDecimal.ZERO;
        for (PurchaseOrderLine pl : po.getLines()) {
            if (pl.getQuantityReceived() == null || pl.getQuantityReceived().signum() <= 0) {
                continue;
            }
            InventoryItem item = pl.getItem();
            if (item != null) {
                itemCdService.ensureItemCd(item);
            }
            BigDecimal qty = pl.getQuantityReceived();
            BigDecimal prc = pl.getUnitPrice() != null ? pl.getUnitPrice() : BigDecimal.ZERO;
            BigDecimal sply = qty.multiply(prc);
            tot = tot.add(sply);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemCd", item != null && item.getItemCd() != null ? item.getItemCd() : "UNKNOWN");
            row.put("itemNm", item != null ? item.getName() : "Item");
            row.put("itemClsCd", item != null && item.getItemClsCd() != null
                    ? item.getItemClsCd()
                    : properties.getDefaultItemClsCd());
            row.put("pkgUnitCd", item != null && item.getPkgUnitCd() != null ? item.getPkgUnitCd() : "NT");
            row.put("qtyUnitCd", item != null && item.getQtyUnitCd() != null ? item.getQtyUnitCd() : "U");
            row.put("qty", qty);
            row.put("prc", prc);
            row.put("splyAmt", sply);
            row.put("taxTyCd", item != null && "A".equalsIgnoreCase(item.getTaxCategory()) ? "A" : "B");
            EbmTaxPayload.enrichLine(row, ++seq, properties.getDefaultItemClsCd());
            lines.add(row);
        }
        if (lines.isEmpty()) {
            return;
        }
        Supplier supplier = po.getSupplier();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tin", device.getTin());
        payload.put("bhfId", device.getBranchId());
        payload.put("invcNo", numericDoc(po.getPoNumber()));
        payload.put("orgInvcNo", 0);
        payload.put("spplrTin", supplier != null ? nullToEmpty(supplier.getTaxId()) : null);
        payload.put("spplrNm", supplier != null ? supplier.getName() : null);
        payload.put("spplrBhfId", "00");
        payload.put("spplrInvcNo", null);
        payload.put("regTyCd", "M");
        payload.put("pchsTyCd", "N");
        payload.put("rcptTyCd", "P");
        payload.put("pmtTyCd", "01");
        payload.put("pchsSttsCd", "02");
        Instant now = Instant.now();
        payload.put("cfmDt", EbmTaxPayload.formatDateTime(now));
        payload.put("pchsDt", EbmTaxPayload.formatDate(now));
        payload.put("wrhsDt", EbmTaxPayload.formatDate(now));
        payload.put("itemList", lines);
        payload.put("regrId", "HotelERP");
        payload.put("regrNm", "HotelERP");
        payload.put("modrId", "HotelERP");
        payload.put("modrNm", "HotelERP");
        EbmTaxPayload.applyHeaderTaxTotals(payload, lines);
        payload.put("totAmt", tot);

        TaxableSaleEvent event = newEvent(device, "PURCHASE_RECEIVE", po.getId(), po.getPoNumber());
        outboxRepository.save(outbox(device, event, "PURCHASE", null, withPhase(payload, "PURCHASE")));
        log.info("EBM enqueued PURCHASE_RECEIVE {} doc={} hotel={}", po.getId(), po.getPoNumber(), hotelId);
    }

    @Transactional
    public void enqueueItemSave(UUID hotelId, InventoryItem item) {
        if (!canEnqueue(hotelId)) {
            return;
        }
        itemCdService.ensureItemCd(item);
        EbmDevice device = deviceService.requireActiveDevice(hotelId);
        // One logical event per item id — update existing pending or create new ITEM_SAVE outbox only
        TaxableSaleEvent event = saleEventRepository
                .findBySourceTypeAndSourceId("ITEM_SAVE", item.getId())
                .orElseGet(() -> newEvent(device, "ITEM_SAVE", item.getId(), item.getItemCd()));
        event.setDocumentNumber(item.getItemCd());
        event.setEbmStatus("PENDING");
        event = saleEventRepository.save(event);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tin", device.getTin());
        payload.put("bhfId", device.getBranchId());
        payload.put("itemCd", item.getItemCd());
        payload.put("itemClsCd", item.getItemClsCd() != null ? item.getItemClsCd() : properties.getDefaultItemClsCd());
        payload.put("itemTyCd", item.getItemTyCd() != null ? item.getItemTyCd() : properties.getDefaultItemTyCd());
        payload.put("itemNm", item.getName());
        payload.put("orgnNatCd", properties.getCountryCode());
        payload.put("pkgUnitCd", item.getPkgUnitCd() != null ? item.getPkgUnitCd() : properties.getDefaultPkgUnitCd());
        payload.put("qtyUnitCd", item.getQtyUnitCd() != null ? item.getQtyUnitCd() : properties.getDefaultQtyUnitCd());
        payload.put("taxTyCd", "A".equalsIgnoreCase(item.getTaxCategory()) ? "A" : "B");
        payload.put("bcd", item.getBarcode());
        payload.put("dftPrc", item.getUnitCost() != null ? item.getUnitCost() : BigDecimal.ZERO);
        payload.put("useYn", "Y");
        payload.put("regrId", "HotelERP");
        payload.put("regrNm", "HotelERP");
        payload.put("modrId", "HotelERP");
        payload.put("modrNm", "HotelERP");

        EbmOutboxEntry entry = outbox(device, event, "ITEM_SAVE", null, withPhase(payload, "ITEM_SAVE"));
        outboxRepository.save(entry);
        log.info("EBM enqueued ITEM_SAVE {} itemCd={} hotel={}", item.getId(), item.getItemCd(), hotelId);
    }

    private List<Map<String, Object>> buildInvInvoiceLines(InvSalesInvoice inv) {
        List<Map<String, Object>> lines = new ArrayList<>();
        int seq = 0;
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
            String taxTy = li.getItem() != null ? li.getItem().getTaxCategory() : "B";
            row.put("taxTyCd", taxTy != null ? taxTy : "B");
            if (li.getItem() != null && li.getItem().getItemClsCd() != null) {
                row.put("itemClsCd", li.getItem().getItemClsCd());
            }
            EbmTaxPayload.enrichLine(row, ++seq, properties.getDefaultItemClsCd());
            lines.add(row);
        }
        return lines;
    }

    private String originalInvcNo(UUID sourceId, String fallbackDoc) {
        return saleEventRepository
                .findBySourceTypeAndSourceId("DEPOT_SALE", sourceId)
                .or(() -> saleEventRepository.findBySourceTypeAndSourceId("INV_SALES_INVOICE", sourceId))
                .or(() -> saleEventRepository.findBySourceTypeAndSourceId("INVOICE", sourceId))
                .map(e -> e.getEbmReceiptNo() != null ? e.getEbmReceiptNo() : e.getDocumentNumber())
                .orElse(fallbackDoc != null ? fallbackDoc : "0");
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
            String paymentMethod,
            String rcptTyCd,
            String orgInvcNo,
            String custTin,
            String custNm) {
        Instant now = Instant.now();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tin", device.getTin());
        payload.put("bhfId", device.getBranchId());
        payload.put("invcNo", numericDoc(docNo));
        payload.put("orgInvcNo", numericDoc(orgInvcNo));
        if (custTin != null && !custTin.isBlank()) {
            payload.put("custTin", custTin.trim());
        }
        if (custNm != null && !custNm.isBlank()) {
            payload.put("custNm", custNm.trim());
        }
        payload.put("salesTyCd", "N");
        payload.put("rcptTyCd", rcptTyCd != null ? rcptTyCd : "S");
        payload.put("pmtTyCd", mapPayment(paymentMethod));
        payload.put("salesSttsCd", "02");
        payload.put("cfmDt", EbmTaxPayload.formatDateTime(now));
        payload.put("salesDt", EbmTaxPayload.formatDate(now));
        payload.put("stockRlsDt", EbmTaxPayload.formatDateTime(now));
        payload.put("prchrAcptcYn", "N");
        payload.put("regrId", "HotelERP");
        payload.put("regrNm", "HotelERP");
        payload.put("modrId", "HotelERP");
        payload.put("modrNm", "HotelERP");
        payload.put("itemList", lines);
        EbmTaxPayload.applyHeaderTaxTotals(payload, lines);
        if (total != null) {
            payload.put("totAmt", total);
        }
        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("custTin", custTin);
        receipt.put("rcptPbctDt", EbmTaxPayload.formatDateTime(now));
        receipt.put("prchrAcptcYn", "N");
        payload.put("receipt", receipt);
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
        TaxableSaleEvent event = newEvent(device, sourceType, sourceId, documentNumber);

        EbmOutboxEntry tx = outbox(device, event, "TRANSACTION", null, withPhase(salePayload, "TRANSACTION"));
        tx = outboxRepository.save(tx);

        EbmOutboxEntry inv = outbox(device, event, "INVOICE", tx, withPhase(salePayload, "INVOICE"));
        inv = outboxRepository.save(inv);

        if (includeStock) {
            Map<String, Object> stockPayload = new LinkedHashMap<>();
            stockPayload.put("tin", device.getTin());
            stockPayload.put("bhfId", device.getBranchId());
            stockPayload.put("sarNo", numericDoc(documentNumber));
            stockPayload.put("ocrnDt", EbmTaxPayload.formatDate(Instant.now()));
            stockPayload.put("itemList", salePayload.get("itemList"));
            stockPayload.put("totItemCnt", salePayload.get("totItemCnt"));
            stockPayload.put("totTaxblAmt", salePayload.get("totTaxblAmt"));
            stockPayload.put("totTaxAmt", salePayload.get("totTaxAmt"));
            stockPayload.put("totAmt", salePayload.get("totAmt"));
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

    private TaxableSaleEvent newEvent(EbmDevice device, String sourceType, UUID sourceId, String documentNumber) {
        TaxableSaleEvent event = new TaxableSaleEvent();
        event.setHotel(device.getHotel());
        event.setDevice(device);
        event.setSourceType(sourceType);
        event.setSourceId(sourceId);
        event.setDocumentNumber(documentNumber);
        event.setEbmStatus("PENDING");
        return saleEventRepository.save(event);
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

    /** Prefer numeric invoice numbers when possible; otherwise hash-stable positive long. */
    static Object numericDoc(String doc) {
        if (doc == null || doc.isBlank()) {
            return 0;
        }
        String digits = doc.replaceAll("\\D+", "");
        if (!digits.isEmpty()) {
            try {
                if (digits.length() > 18) {
                    digits = digits.substring(digits.length() - 18);
                }
                return Long.parseLong(digits);
            } catch (NumberFormatException ignored) {
                // fall through
            }
        }
        return Math.floorMod(doc.hashCode(), Integer.MAX_VALUE);
    }

    private static String nullToEmpty(String s) {
        return s == null || s.isBlank() ? null : s.trim();
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
