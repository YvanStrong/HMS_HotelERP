import { apiFetch } from "@/lib/api";

export type EbmDeviceView = {
  id: string;
  mode: string;
  tin: string;
  branchId: string | null;
  deviceSerialNo: string;
  sdcId: string | null;
  mrcNo: string | null;
  vsdcEndpointUrl: string | null;
  status: string;
  lastSignatureAt: string | null;
  lastError: string | null;
  hasSigningKey: boolean;
  createdAt: string;
  trainingMode?: boolean;
};

export type EbmStatus = {
  ebmEnabled: boolean;
  hotelTin: string | null;
  devices: EbmDeviceView[];
  pendingOutbox: number;
  failedSaleEvents: number;
  offlineAlertLevel: string;
  lastSignatureAt: string | null;
  trainingMode?: boolean;
};

export type EbmOutboxRow = {
  id: string;
  phase: string;
  status: string;
  saleEventId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  submittedAt: string | null;
  ackedAt: string | null;
};

export type EbmSaleEventRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  documentNumber: string | null;
  ebmStatus: string;
  ebmReceiptNo: string | null;
  ebmSignature?: string | null;
  ebmInternalData?: string | null;
  ebmInvoiceNo?: string | null;
  ebmQrPayload?: string | null;
  ebmSdcId?: string | null;
  ebmMrcNo?: string | null;
  createdAt: string;
};

export type EbmCodeListRow = {
  id: string;
  category: string;
  code: string;
  name: string | null;
  parentCode: string | null;
  syncedAt: string;
};

export function loadEbmStatus(hotelId: string) {
  return apiFetch<EbmStatus>(`/api/v1/hotels/${hotelId}/ebm/status`, { quiet: true });
}

export function registerEbmDevice(
  hotelId: string,
  body: {
    mode: string;
    tin?: string;
    branchId?: string;
    deviceSerialNo: string;
    vsdcEndpointUrl: string;
  },
) {
  return apiFetch<EbmDeviceView>(`/api/v1/hotels/${hotelId}/ebm/devices`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function initializeEbmDevice(hotelId: string, deviceId: string) {
  return apiFetch<EbmDeviceView>(`/api/v1/hotels/${hotelId}/ebm/devices/${deviceId}/initialize`, {
    method: "POST",
  });
}

export function disableEbmDevice(hotelId: string, deviceId: string) {
  return apiFetch<EbmDeviceView>(`/api/v1/hotels/${hotelId}/ebm/devices/${deviceId}/disable`, {
    method: "POST",
  });
}

export function setEbmTrainingMode(hotelId: string, deviceId: string, enabled: boolean) {
  return apiFetch<EbmDeviceView>(`/api/v1/hotels/${hotelId}/ebm/devices/${deviceId}/training`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export function syncEbmNow(hotelId: string, category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<{ synced: number }>(`/api/v1/hotels/${hotelId}/ebm/sync${q}`, { method: "POST" });
}

export function loadEbmXzReport(hotelId: string, type: "X" | "Z" = "X") {
  return apiFetch<Record<string, unknown>>(`/api/v1/hotels/${hotelId}/ebm/reports/xz?type=${type}`, { quiet: true });
}

export function loadEbmPluReport(hotelId: string) {
  return apiFetch<Record<string, unknown>>(`/api/v1/hotels/${hotelId}/ebm/reports/plu`, { quiet: true });
}

export function loadEbmOutbox(hotelId: string, limit = 50) {
  return apiFetch<EbmOutboxRow[]>(`/api/v1/hotels/${hotelId}/ebm/outbox?limit=${limit}`, { quiet: true });
}

export function retryEbmOutbox(hotelId: string, outboxId: string) {
  return apiFetch<EbmOutboxRow>(`/api/v1/hotels/${hotelId}/ebm/outbox/${outboxId}/retry`, {
    method: "POST",
  });
}

export function retryAllFailedEbmOutbox(hotelId: string) {
  return apiFetch<{ retried: number }>(`/api/v1/hotels/${hotelId}/ebm/outbox/retry-failed`, {
    method: "POST",
  });
}

export function loadEbmSaleEvents(hotelId: string, limit = 50) {
  return apiFetch<EbmSaleEventRow[]>(`/api/v1/hotels/${hotelId}/ebm/sale-events?limit=${limit}`, { quiet: true });
}

export function loadEbmSaleEventBySource(hotelId: string, sourceType: string, sourceId: string) {
  return apiFetch<EbmSaleEventRow>(
    `/api/v1/hotels/${hotelId}/ebm/sale-events/by-source?sourceType=${encodeURIComponent(sourceType)}&sourceId=${encodeURIComponent(sourceId)}`,
    { quiet: true },
  );
}

export function loadEbmCodeLists(hotelId: string, category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<EbmCodeListRow[]>(`/api/v1/hotels/${hotelId}/ebm/code-lists${q}`, { quiet: true });
}
