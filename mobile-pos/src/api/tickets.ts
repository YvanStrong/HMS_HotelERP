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

};



export type KitchenTicketRow = {

  ticketId: string;

  tableLabel: string;

  depotName: string;

  status: string;

  updatedAt: string;

  lines: TicketLine[];

};



function toTicketLines(lines: CartLine[]) {

  return lines.map((l) => ({

    productId: l.productId,

    quantity: l.qty,

    notes: l.notes ?? undefined,

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

    lines?: CartLine[];

  },

): Promise<TicketDetail> {

  const { data } = await apiClient.post<TicketDetail>(`/api/v1/hotels/${hotelId}/pos/tickets`, {

    depotId: payload.depotId,

    tableLabel: payload.tableLabel,

    tableId: payload.tableId,

    customerName: payload.customerName,

    guestCount: payload.guestCount,

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



export async function sendTicketToKitchen(hotelId: string, ticketId: string): Promise<TicketDetail> {

  const { data } = await apiClient.post<TicketDetail>(

    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/send-to-kitchen`,

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

