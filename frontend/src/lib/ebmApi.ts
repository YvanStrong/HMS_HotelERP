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
};

export type EbmStatus = {
  ebmEnabled: boolean;
  hotelTin: string | null;
  devices: EbmDeviceView[];
  pendingOutbox: number;
  failedSaleEvents: number;
  offlineAlertLevel: string;
  lastSignatureAt: string | null;
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
  createdAt: string;
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

export function loadEbmOutbox(hotelId: string, limit = 50) {
  return apiFetch<EbmOutboxRow[]>(`/api/v1/hotels/${hotelId}/ebm/outbox?limit=${limit}`, { quiet: true });
}

export function loadEbmSaleEvents(hotelId: string, limit = 50) {
  return apiFetch<EbmSaleEventRow[]>(`/api/v1/hotels/${hotelId}/ebm/sale-events?limit=${limit}`, { quiet: true });
}
