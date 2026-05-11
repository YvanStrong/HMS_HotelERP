package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.time.LocalTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class InventoryDtos {

    private InventoryDtos() {}

    public record SupplierSummary(UUID id, String name) {}

    public record CategorySummary(UUID id, String name, String code) {}

    public record InventoryItemRow(
            UUID id,
            String name,
            String sku,
            String category,
            BigDecimal currentStock,
            BigDecimal minimumStock,
            BigDecimal reorderPoint,
            String unitOfMeasure,
            BigDecimal unitCost,
            boolean isMinibarItem,
            Integer minibarReorderThreshold,
            String status,
            Instant lastRestocked,
            SupplierSummary supplier,
            String description,
            String barcode,
            BigDecimal sellingPrice,
            boolean active,
            LocalDate expiryDate,
            LocalDate manufactureDate,
            String valuationMethod,
            String imageUrl) {}

    public record InventoryListSummary(
            long totalItems, long lowStockCount, long outOfStockCount, BigDecimal totalValue) {}

    public record InventoryItemsResponse(List<InventoryItemRow> data, InventoryListSummary summary) {}

    public record ConsumeReference(String type, String id) {}

    public record ConsumeLocation(String from, String to) {}

    public record ConsumeRequest(
            BigDecimal quantity,
            String type,
            ConsumeReference reference,
            ConsumeLocation location,
            String performedBy,
            String notes,
            Boolean autoReorderCheck) {}

    public record ConsumeRoomChargeSummary(UUID chargeId, BigDecimal amount, boolean postedToFolio) {}

    public record ConsumeAlert(String type, String message, BigDecimal suggestedOrderQuantity, String supplier) {}

    public record ConsumeEvent(String type, String itemId, BigDecimal quantity, String chargeId) {}

    public record ConsumeResponse(
            UUID transactionId,
            InventoryItemRow item,
            ConsumeRoomChargeSummary roomCharge,
            List<ConsumeAlert> alerts,
            List<ConsumeEvent> events) {}

    public record PoLineInput(UUID itemId, BigDecimal quantity, BigDecimal unitPrice, String notes) {}

    public record PoApprovalInput(Boolean requiresApproval, List<String> approverRoles, BigDecimal thresholdAmount) {}

    public record CreatePurchaseOrderRequest(
            UUID supplierId,
            LocalDate expectedDelivery,
            String paymentTerms,
            List<PoLineInput> lines,
            PoApprovalInput approvalWorkflow,
            String deliveryInstructions) {}

    public record PoLineResponse(UUID lineId, String itemName, String sku, BigDecimal quantity, BigDecimal unitPrice, BigDecimal lineTotal) {}

    public record CreatePurchaseOrderResponse(
            UUID poId,
            String poNumber,
            String status,
            BigDecimal totalAmount,
            List<PoLineResponse> lines,
            List<String> nextSteps,
            String approvalUrl) {}

    public record ReceiveLineInput(
            UUID poLineId, BigDecimal quantityReceived, String qualityCheck, String notes, String batchNumber, String expiryDate) {}

    public record ReceiveGoodsRequest(
            UUID purchaseOrderId,
            List<ReceiveLineInput> receivedLines,
            String deliveryNote,
            String receivedBy,
            String location) {}

    public record ReceivePoSummary(String poNumber, String status, BigDecimal remainingQuantity) {}

    public record ReceiveStockUpdate(UUID itemId, BigDecimal previousStock, BigDecimal quantityReceived, BigDecimal newStock, String status) {}

    public record ReceiveDiscrepancy(String type, UUID itemId, BigDecimal expected, BigDecimal received, String action) {}

    public record ReceiveAlert(String type, String message) {}

    public record ReceiveGoodsResponse(
            UUID receiptId,
            ReceivePoSummary purchaseOrder,
            List<ReceiveStockUpdate> stockUpdates,
            List<ReceiveDiscrepancy> discrepancies,
            List<ReceiveAlert> alerts) {}

    public record SupplierCreateRequest(
            @NotBlank String name, String contactPerson, String email, String phone) {}

    public record CategoryCreateRequest(@NotBlank String name, String code) {}

    public record InventoryItemCreateRequest(
            @NotBlank String name,
            String sku,
            @NotNull UUID categoryId,
            BigDecimal currentStock,
            BigDecimal reorderPoint,
            BigDecimal unitCost,
            Boolean isMinibarItem,
            Integer minibarReorderThreshold,
            String unitOfMeasure,
            String description,
            String barcode,
            BigDecimal sellingPrice,
            String imageUrl,
            LocalDate expiryDate,
            LocalDate manufactureDate) {}

    public record InventoryItemPatchRequest(
            String name,
            String sku,
            UUID categoryId,
            BigDecimal reorderPoint,
            BigDecimal minimumStock,
            BigDecimal maximumStock,
            BigDecimal unitCost,
            BigDecimal sellingPrice,
            String unitOfMeasure,
            String description,
            String barcode,
            String imageUrl,
            LocalDate expiryDate,
            LocalDate manufactureDate,
            Boolean active,
            String valuationMethod) {}

    public record CreatedIdResponse(UUID id) {}

    // ── Supplier full detail ───────────────────────────────────────────────

    public record SupplierDetail(
            UUID id, String name, String contactPerson, String email, String phone,
            String address, String taxId, String paymentDetails,
            BigDecimal rating, BigDecimal outstandingBalance, BigDecimal creditLimit,
            Instant createdAt) {}

    public record SupplierUpdateRequest(
            String contactPerson, String email, String phone, String address,
            String taxId, String paymentDetails, BigDecimal creditLimit) {}

    // ── Purchase order listing ─────────────────────────────────────────────

    public record PurchaseOrderSummary(
            UUID poId, String poNumber, String supplierName, String status,
            BigDecimal totalAmount, LocalDate expectedDelivery, Instant createdAt) {}

    // ── Stock adjustment ──────────────────────────────────────────────────

    public record StockAdjustRequest(
            @NotNull UUID itemId,
            @NotBlank String adjustmentType,   // ADD, REMOVE, SET
            BigDecimal quantity,
            BigDecimal newQuantity,
            String reason,
            String notes) {}

    public record StockAdjustResponse(
            UUID itemId, String itemName, String sku,
            BigDecimal quantityBefore, BigDecimal quantityAfter, String adjustmentType,
            UUID transactionId) {}

    // ── Stock movements listing ──────────────────────────────────────────

    public record MovementItem(
            UUID id, String itemName, String sku,
            String type, BigDecimal quantity, String reference,
            String performedBy, String notes, Instant timestamp) {}

    // ── Stock alerts ──────────────────────────────────────────────────────

    public record LowStockAlert(
            UUID itemId, String name, String sku, String category,
            BigDecimal currentStock, BigDecimal reorderPoint, String alertType) {}

    public record StockAlertSummary(
            int lowStockCount, int outOfStockCount,
            List<LowStockAlert> items) {}

    // ── Barcode ───────────────────────────────────────────────────────────

    public record BarcodeResponse(UUID itemId, String sku, String barcode, String qrDataUri) {}

    // ── Warehouses ────────────────────────────────────────────────────────

    public record WarehouseCreateRequest(@NotBlank String name, @NotBlank String code, String address, Boolean isDefault) {}

    public record WarehouseItem(UUID id, String name, String code, String address, boolean isDefault, boolean active) {}

    // ── Customers ─────────────────────────────────────────────────────────

    public record CustomerCreateRequest(
            @NotBlank String name, String code, String phone, String email,
            String address, BigDecimal creditLimit) {}

    public record CustomerItem(
            UUID id, String name, String code, String phone, String email,
            BigDecimal creditLimit, BigDecimal outstandingBalance, boolean active) {}

    // ── Sales Invoices ────────────────────────────────────────────────────

    public record SalesInvoiceLineInput(
            @NotNull UUID itemId,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal discountPct,
            BigDecimal taxRate) {}

    public record SalesInvoiceCreateRequest(
            UUID customerId,
            String customerName,
            LocalDate invoiceDate,
            LocalDate dueDate,
            List<SalesInvoiceLineInput> lines,
            BigDecimal discountAmount,
            String paymentMethod,
            String notes) {}

    public record SalesInvoiceLineItem(
            UUID id, String itemName, String sku,
            BigDecimal quantity, BigDecimal unitPrice, BigDecimal discountPct,
            BigDecimal taxRate, BigDecimal subtotal, BigDecimal profit) {}

    public record SalesInvoiceItem(
            UUID id, String invoiceNumber, String status, String customerName,
            LocalDate invoiceDate, LocalDate dueDate,
            BigDecimal subtotal, BigDecimal discountAmount, BigDecimal taxAmount,
            BigDecimal totalAmount, BigDecimal amountPaid, BigDecimal balanceDue,
            String paymentMethod, List<SalesInvoiceLineItem> lines,
            BigDecimal totalProfit, Instant createdAt) {}

    public record SalesInvoiceSummary(
            UUID id, String invoiceNumber, String status, String customerName,
            LocalDate invoiceDate, BigDecimal totalAmount, BigDecimal amountPaid,
            BigDecimal balanceDue, String paymentMethod) {}

    public record SalesPaymentRequest(BigDecimal amount, @NotBlank String paymentMethod, String notes) {}

    // ── Stock Transfers ───────────────────────────────────────────────────

    public record TransferLineInput(@NotNull UUID itemId, BigDecimal quantity) {}

    public record TransferCreateRequest(
            @NotNull UUID fromWarehouseId,
            @NotNull UUID toWarehouseId,
            List<TransferLineInput> items,
            String notes) {}

    public record TransferLineItem(UUID itemId, String itemName, String sku, BigDecimal quantity) {}

    public record TransferItem(
            UUID id, String transferNumber, String status,
            String fromWarehouse, String toWarehouse,
            LocalDate transferDate, List<TransferLineItem> items,
            String transferredBy, Instant createdAt, Instant completedAt) {}

    // ── Dashboard ─────────────────────────────────────────────────────────

    public record DashboardItem(UUID id, String name, String sku, BigDecimal value) {}

    public record InvDashboardResponse(
            long totalProducts,
            BigDecimal totalStockValue,
            long lowStockCount,
            long outOfStockCount,
            BigDecimal todaySales,
            BigDecimal todayPurchases,
            long pendingPOCount,
            long totalSuppliers,
            long totalCustomers,
            List<DashboardItem> lowStockItems,
            List<DashboardItem> fastMovingProducts,
            List<DashboardItem> deadStockProducts) {}

    // ── Reports ───────────────────────────────────────────────────────────

    public record SalesReportLine(
            UUID invoiceId, String invoiceNumber, LocalDate invoiceDate,
            String customerName, BigDecimal totalAmount, BigDecimal amountPaid,
            String status, String paymentMethod) {}

    public record SalesReport(
            LocalDate fromDate, LocalDate toDate,
            BigDecimal totalRevenue, BigDecimal totalPaid,
            long invoiceCount, List<SalesReportLine> lines) {}

    public record PurchaseReportLine(
            UUID poId, String poNumber, LocalDate orderDate,
            String supplierName, BigDecimal totalAmount, String status, String paymentTerms) {}

    public record PurchaseReport(
            LocalDate fromDate, LocalDate toDate,
            BigDecimal totalPurchases, long poCount,
            List<PurchaseReportLine> lines) {}

    public record StockValueItem(
            UUID id, String name, String sku, String category,
            BigDecimal currentStock, BigDecimal unitCost, BigDecimal totalValue) {}

    public record StockValueReport(
            BigDecimal grandTotal, int itemCount, List<StockValueItem> items) {}

    public record ProfitReportLine(
            UUID invoiceId,
            String invoiceNumber,
            LocalDate invoiceDate,
            String customerName,
            BigDecimal revenue,
            BigDecimal estimatedCost,
            BigDecimal profit) {}

    public record ProfitReport(
            LocalDate fromDate,
            LocalDate toDate,
            BigDecimal totalRevenue,
            BigDecimal totalCost,
            BigDecimal totalProfit,
            List<ProfitReportLine> lines) {}

    public record ExpiredProductLine(
            UUID itemId, String name, String sku, LocalDate expiryDate, BigDecimal currentStock) {}

    public record PurchaseReturnLineInput(UUID poLineId, BigDecimal quantity) {}

    public record PurchaseReturnRequest(List<PurchaseReturnLineInput> lines, String notes) {}

    public record UserActivityLine(String username, long movementCount) {}
}
