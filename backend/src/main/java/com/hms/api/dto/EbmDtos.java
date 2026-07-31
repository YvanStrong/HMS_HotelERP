package com.hms.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class EbmDtos {
    private EbmDtos() {}

    public record RegisterDeviceRequest(
            String mode,
            String tin,
            String branchId,
            String deviceSerialNo,
            String vsdcEndpointUrl) {}

    public record DeviceView(
            UUID id,
            String mode,
            String tin,
            String branchId,
            String deviceSerialNo,
            String sdcId,
            String mrcNo,
            String vsdcEndpointUrl,
            String status,
            Instant lastSignatureAt,
            String lastError,
            boolean hasSigningKey,
            Instant createdAt) {}

    public record StatusResponse(
            boolean ebmEnabled,
            String hotelTin,
            List<DeviceView> devices,
            long pendingOutbox,
            long failedSaleEvents,
            String offlineAlertLevel,
            Instant lastSignatureAt) {}

    public record OutboxRow(
            UUID id,
            String phase,
            String status,
            UUID saleEventId,
            int attempts,
            String lastError,
            Instant createdAt,
            Instant submittedAt,
            Instant ackedAt) {}

    public record SaleEventRow(
            UUID id,
            String sourceType,
            UUID sourceId,
            String documentNumber,
            String ebmStatus,
            String ebmReceiptNo,
            String ebmSignature,
            String ebmQrPayload,
            String ebmSdcId,
            String ebmMrcNo,
            Instant createdAt) {}

    public record CodeListRow(UUID id, String category, String code, String name, String parentCode, Instant syncedAt) {}

    public record ClassifyItemRequest(
            String itemTyCd,
            String pkgUnitCd,
            String qtyUnitCd,
            String itemClsCd,
            boolean regenerateItemCd,
            Boolean saveToVsdc) {}

    public record ItemCdView(UUID itemId, String itemCd, String itemTyCd, String pkgUnitCd, String qtyUnitCd, String itemClsCd) {}
}
