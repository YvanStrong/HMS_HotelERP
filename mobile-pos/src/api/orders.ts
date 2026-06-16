import type {
  CartLine,
  CreateDeliveryRequest,
  CreateDeliveryResponse,
  CreateSaleRequest,
  CreateSaleResponse,
} from "../types";
import { apiClient } from "./client";

function toLines(lines: CartLine[]) {
  return lines.map((l) => ({
    productId: l.productId,
    quantity: l.qty,
    notes: l.notes ?? undefined,
  }));
}

export async function createSale(
  hotelId: string,
  payload: CreateSaleRequest,
): Promise<CreateSaleResponse> {
  const { data } = await apiClient.post<CreateSaleResponse>(
    `/api/v1/hotels/${hotelId}/inventory/sales`,
    payload,
  );
  return data;
}

export async function createDelivery(
  hotelId: string,
  payload: CreateDeliveryRequest,
): Promise<CreateDeliveryResponse> {
  const { data } = await apiClient.post<CreateDeliveryResponse>(
    `/api/v1/hotels/${hotelId}/inventory/deliveries`,
    payload,
  );
  return data;
}

export function buildSalePayload(opts: {
  depotId: string;
  lines: CartLine[];
  tableLabel?: string | null;
  customerName?: string;
  chargeToRoom?: boolean;
  reservationId?: string;
  paymentMethod?: string;
  staffId?: string;
}): CreateSaleRequest {
  const label = opts.tableLabel?.trim();
  const customerName = opts.customerName?.trim() || label || "Walk-in";
  return {
    depotId: opts.depotId,
    lines: toLines(opts.lines),
    customerName: label ? `${label} — ${customerName}` : customerName,
    chargeToRoom: opts.chargeToRoom,
    reservationId: opts.reservationId,
    paymentMethod: opts.chargeToRoom ? "ROOM" : opts.paymentMethod,
    tableLabel: label ?? undefined,
    staffId: opts.staffId,
  };
}

export function buildDeliveryPayload(opts: {
  depotId: string;
  lines: CartLine[];
  tableLabel?: string | null;
  customerName?: string;
  staffId?: string;
  /** Shown on HMS Deliveries — e.g. "Cash", "Card", "Room 12" */
  paymentNote?: string;
}): CreateDeliveryRequest {
  const label = opts.tableLabel?.trim();
  const base = opts.customerName?.trim() || label || "Walk-in";
  const customerName = opts.paymentNote ? `${base} (${opts.paymentNote})` : base;
  return {
    depotId: opts.depotId,
    lines: toLines(opts.lines),
    locationLabel: label ?? "Counter",
    customerName,
    staffId: opts.staffId,
  };
}
