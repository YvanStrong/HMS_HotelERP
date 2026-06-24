import type { CartLine } from "../types";

import { apiClient } from "./client";



export type PosTableRow = {

  id: string;

  tableLabel: string;

  sortOrder: number;

  capacity: number;

  active?: boolean;

  occupied: boolean;

  activeTicketId?: string | null;

  waiterName?: string | null;

};



export type TicketLine = {

  id: string;

  productId: string;

  productName: string;

  quantity: number | string;

  unitPrice: number | string;

  lineTotal: number | string;

  notes?: string | null;

  lineStatus: string;

  taxable: boolean;

  round: number;

  sentAt?: string | null;

  servedAt?: string | null;

  voided?: boolean;
  voidReason?: string | null;
  discountPct?: number | string | null;
  discountAmount?: number | string | null;
  effectivePrice?: number | string | null;
  menuCategory?: string | null;
  held?: boolean;
  holdCourse?: string | null;
  allergens?: string[];
  dietaryFlags?: string[];
};



export type TicketDetail = {

  id: string;

  depotId: string;

  depotName: string;

  tableId?: string | null;

  tableLabel: string;

  status: string;

  customerName?: string | null;

  subtotal: number | string;

  taxAmount: number | string;

  totalAmount: number | string;

  discountTotal?: number | string | null;

  currentRound: number;

  openedAt?: string;

  kitchenSentAt?: string | null;

  closedAt?: string | null;

  waiterName?: string | null;

  lines: TicketLine[];

  saleId?: string | null;

  saleNumber?: string | null;

  deliveryOrderId?: string | null;

  deliveryNumber?: string | null;

  guestCount?: number;

  reservationId?: string | null;

  roomNumber?: string | null;

  dietaryNotes?: string | null;

  reservationSpecialRequests?: string | null;

  reservationCheckInTime?: string | null;

  tipAmount?: number | string | null;

};



export type KitchenTicketRow = {

  ticketId: string;

  tableLabel: string;

  depotName: string;

  status: string;

  updatedAt: string;

  lines: TicketLine[];

};



export type TicketRow = {
  id: string;
  tableId?: string | null;
  tableLabel: string;
  status: string;
  lineCount: number;
  waiterName?: string | null;
  customerName?: string | null;
};



function toTicketLines(lines: CartLine[]) {
  return lines.map((l) => ({
    productId: l.productId,
    quantity: l.qty,
    notes: l.notes ?? undefined,
    isHeld: l.isHeld ?? false,
    holdCourse: l.holdCourse ?? undefined,
  }));
}



export async function fetchPosTables(hotelId: string, depotId: string): Promise<PosTableRow[]> {

  const { data } = await apiClient.get<PosTableRow[]>(`/api/v1/hotels/${hotelId}/pos/tables`, {

    params: { depotId },

  });

  return data ?? [];

}



export async function fetchTicket(hotelId: string, ticketId: string): Promise<TicketDetail> {

  const { data } = await apiClient.get<TicketDetail>(`/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}`);

  return data;

}



export async function fetchKitchenBoard(hotelId: string, depotId: string): Promise<KitchenTicketRow[]> {

  const { data } = await apiClient.get<KitchenTicketRow[]>(`/api/v1/hotels/${hotelId}/pos/kitchen-board`, {

    params: { depotId },

  });

  return data ?? [];

}



export async function openTicket(

  hotelId: string,

  payload: {

    depotId: string;

    tableLabel: string;

    tableId?: string;

    customerName?: string;

    guestCount?: number;

    reservationId?: string;

    lines?: CartLine[];

  },

): Promise<TicketDetail> {

  const { data } = await apiClient.post<TicketDetail>(`/api/v1/hotels/${hotelId}/pos/tickets`, {

    depotId: payload.depotId,

    tableLabel: payload.tableLabel,

    tableId: payload.tableId,

    customerName: payload.customerName,

    guestCount: payload.guestCount,

    reservationId: payload.reservationId,

    lines: payload.lines?.length ? toTicketLines(payload.lines) : [],

  });

  return data;

}



export async function createTicket(

  hotelId: string,

  payload: {

    depotId: string;

    tableLabel: string;

    tableId?: string;

    customerName?: string;

    lines: CartLine[];

  },

): Promise<TicketDetail> {

  return openTicket(hotelId, payload);

}



export async function addTicketLines(

  hotelId: string,

  ticketId: string,

  lines: CartLine[],

): Promise<TicketDetail> {

  const { data } = await apiClient.post<TicketDetail>(

    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines`,

    { lines: toTicketLines(lines) },

  );

  return data;

}



export async function sendTicketToKitchen(
  hotelId: string,
  ticketId: string,
  options?: { fireHeld?: boolean },
): Promise<TicketDetail> {
  const { data } = await apiClient.post<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/send-to-kitchen`,
    options?.fireHeld ? { fireHeld: true } : {},
  );
  return data;
}

export async function fireHeldItems(
  hotelId: string,
  ticketId: string,
  course?: "STARTER" | "MAIN" | "DESSERT",
): Promise<TicketDetail> {
  const { data } = await apiClient.post<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/fire`,
    course ? { course } : {},
  );
  return data;
}



export async function markLineReady(hotelId: string, ticketId: string, lineId: string): Promise<TicketDetail> {

  const { data } = await apiClient.patch<TicketDetail>(

    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines/${lineId}/ready`,

  );

  return data;

}



export async function markLineServed(hotelId: string, ticketId: string, lineId: string): Promise<TicketDetail> {

  const { data } = await apiClient.patch<TicketDetail>(

    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines/${lineId}/served`,

  );

  return data;

}



export async function cancelTicket(hotelId: string, ticketId: string): Promise<TicketDetail> {

  const { data } = await apiClient.post<TicketDetail>(

    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/cancel`,

  );

  return data;

}



export async function closeTicket(

  hotelId: string,

  ticketId: string,

  body: {

    mode: string;

    paymentMethod?: string;

    chargeToRoom?: boolean;

    reservationId?: string;

    customerName?: string;

    tipAmount?: number;

  },

): Promise<TicketDetail> {

  const { data } = await apiClient.post<TicketDetail>(

    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/close`,

    body,

  );

  return data;

}



export function money(v: number | string | undefined | null): number {

  if (v == null) return 0;

  return typeof v === "number" ? v : Number(v) || 0;

}

export async function removePendingLine(
  hotelId: string,
  ticketId: string,
  lineId: string,
): Promise<TicketDetail> {
  const { data } = await apiClient.delete<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines/${lineId}`,
  );
  return data;
}

export async function voidLine(
  hotelId: string,
  ticketId: string,
  lineId: string,
  body: { reason: string; managerPin: string },
): Promise<TicketDetail> {
  const { data } = await apiClient.post<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines/${lineId}/void`,
    body,
  );
  return data;
}

export async function applyLineDiscount(
  hotelId: string,
  ticketId: string,
  lineId: string,
  body: {
    discountType: "PERCENT" | "AMOUNT";
    discountValue: number;
    reason: string;
    managerPin: string;
  },
): Promise<TicketDetail> {
  const { data } = await apiClient.post<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines/${lineId}/discount`,
    body,
  );
  return data;
}

export async function getTicketAudit(hotelId: string, ticketId: string) {
  const { data } = await apiClient.get(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/audit`,
  );
  return data;
}

export async function fetchOpenTickets(
  hotelId: string,
  depotId: string,
  status = "OPEN,SENT_TO_KITCHEN",
): Promise<TicketRow[]> {
  const { data } = await apiClient.get<TicketRow[]>(`/api/v1/hotels/${hotelId}/pos/tickets`, {
    params: { depotId, status },
  });
  return data ?? [];
}

export async function transferTicket(
  hotelId: string,
  ticketId: string,
  newTableId: string,
): Promise<TicketDetail> {
  const { data } = await apiClient.post<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/transfer`,
    { newTableId },
  );
  return data;
}

export async function mergeTickets(
  hotelId: string,
  targetTicketId: string,
  sourceTicketId: string,
): Promise<TicketDetail> {
  const { data } = await apiClient.post<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${targetTicketId}/merge`,
    { sourceTicketId },
  );
  return data;
}

export async function reassignTicket(
  hotelId: string,
  ticketId: string,
  newWaiterUserId: string,
): Promise<TicketDetail> {
  const { data } = await apiClient.post<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/reassign`,
    { newWaiterUserId },
  );
  return data;
}
