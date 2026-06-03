package com.hms.api.dto;

import com.hms.domain.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class EventOpsDtos {

    private EventOpsDtos() {}

    public record VenueOption(UUID id, String name, String code) {}

    public record DepotProductOption(UUID id, String productName, String productCode, BigDecimal sellingPrice, boolean taxable) {}

    public record CateringPackageRequest(
            @NotBlank String packageName,
            String description,
            EventCateringPackageType packageType,
            @NotNull @PositiveOrZero BigDecimal pricePerPax,
            Boolean taxable,
            Boolean active) {}

    public record CateringPackageResponse(
            UUID id,
            String packageName,
            String description,
            EventCateringPackageType packageType,
            BigDecimal pricePerPax,
            boolean taxable,
            boolean active) {}

    public record CateringLineRequest(
            UUID cateringPackageId,
            UUID depotProductId,
            String description,
            @NotNull @PositiveOrZero BigDecimal quantity,
            BigDecimal unitPrice) {}

    public record CateringLineResponse(
            UUID id,
            UUID cateringPackageId,
            String cateringPackageName,
            UUID depotProductId,
            String depotProductCode,
            String description,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal,
            boolean taxable) {}

    public record QuoteLineRequest(
            EventQuoteLineType lineType,
            @NotBlank String description,
            @NotNull @PositiveOrZero BigDecimal quantity,
            @NotNull @PositiveOrZero BigDecimal unitPrice,
            Boolean taxable) {}

    public record QuoteLineResponse(
            UUID id,
            EventQuoteLineType lineType,
            String description,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal,
            boolean taxable,
            String chargeReferenceId) {}

    public record QuotePatchRequest(
            EventQuoteStatus status,
            BigDecimal discountAmount,
            BigDecimal depositRequired,
            Boolean depositPaid,
            LocalDate validUntil,
            String internalNotes,
            String clientNotes,
            List<QuoteLineRequest> lines) {}

    public record QuoteResponse(
            UUID id,
            UUID eventId,
            UUID groupId,
            EventQuoteStatus status,
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal discountAmount,
            BigDecimal totalAmount,
            BigDecimal depositRequired,
            boolean depositPaid,
            LocalDate validUntil,
            String internalNotes,
            String clientNotes,
            Instant chargesPostedAt,
            Instant chargesReversedAt,
            List<QuoteLineResponse> lines) {}

    public record PrintableQuoteResponse(
            QuoteResponse quote,
            EventBookingDtos.EventBookingResponse event,
            String groupName,
            String companyName,
            String contactPerson,
            String contactEmail,
            String contactPhone,
            String hotelName,
            String hotelAddress,
            String hotelPhone,
            String hotelEmail,
            String currency) {}

    public record BeoAgendaItem(String time, String activity) {}

    public record BeoEquipmentItem(String item, Integer quantity) {}

    public record BeoServiceTiming(String time, String course, String notes) {}

    public record BeoSectionUpdateRequest(
            String agendaItems,
            String setupStyle,
            String roomLayoutNotes,
            Integer expectedPax,
            Integer guaranteedPax,
            String avRequirements,
            String equipmentList,
            String menuNotes,
            String dietaryRestrictions,
            String serviceTimings,
            String beverageNotes,
            Integer banquetStaffCount,
            String kitchenNotes,
            String housekeepingNotes,
            String maintenanceNotes,
            String securityNotes,
            String financeNotes,
            Boolean depositConfirmed,
            String internalNotes) {}

    public record BeoStatusRequest(@NotNull BanquetEventOrderStatus newStatus) {}

    public record BeoResponse(
            UUID id,
            UUID eventId,
            int version,
            BanquetEventOrderStatus status,
            Instant distributedAt,
            Instant lockedAt,
            String agendaItems,
            String setupStyle,
            String roomLayoutNotes,
            Integer expectedPax,
            Integer guaranteedPax,
            String avRequirements,
            String equipmentList,
            String menuNotes,
            String dietaryRestrictions,
            String serviceTimings,
            String beverageNotes,
            Integer banquetStaffCount,
            String kitchenNotes,
            String housekeepingNotes,
            String maintenanceNotes,
            String securityNotes,
            String financeNotes,
            boolean depositConfirmed,
            String internalNotes,
            String createdBy,
            String lastUpdatedBy) {}

    public record FullBeoResponse(
            BeoResponse beo,
            EventBookingDtos.EventBookingResponse event,
            String groupName,
            String contactPerson,
            String contactEmail,
            String contactPhone,
            List<CateringLineResponse> cateringLines,
            QuoteResponse quote) {}

    public record EventListItem(
            EventBookingDtos.EventBookingResponse event,
            EventQuoteStatus quoteStatus,
            BanquetEventOrderStatus beoStatus,
            UUID quoteId,
            UUID beoId) {}

    public record EventBillingSummaryResponse(
            UUID groupId,
            BigDecimal totalQuoted,
            BigDecimal totalAccepted,
            BigDecimal totalPosted,
            BigDecimal depositCollected,
            BigDecimal outstandingBalance,
            List<EventBillingRow> events) {}

    public record EventBillingRow(
            UUID eventId,
            String eventName,
            EventQuoteStatus quoteStatus,
            BigDecimal totalAmount,
            boolean depositPaid,
            boolean chargesPosted,
            Instant chargesPostedAt) {}

    public record EventBillingDocumentRow(
            UUID id,
            String documentNumber,
            EventBillingDocumentType documentType,
            UUID eventId,
            String eventName,
            String groupName,
            String contactPerson,
            BigDecimal totalAmount,
            BigDecimal amountPaid,
            BigDecimal balanceDue,
            String currency,
            Instant createdAt,
            Instant updatedAt) {}
}
