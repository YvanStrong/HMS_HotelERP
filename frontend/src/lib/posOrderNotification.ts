"use client";

export const HMS_POS_ORDER_EVENT = "hms:pos-order";

export type PosOrderNotification = {
  eventId: string;
  eventType: string;
  title: string;
  body: string;
  staffUsername: string | null;
  staffDisplayName: string | null;
  tableLabel: string | null;
  depotName: string | null;
  itemCount: number;
  itemSummary: string | null;
  at: string;
  ticketId: string | null;
  saleId: string | null;
  deliveryOrderId: string | null;
};

export type PosOrderPopupDetail = {
  notification: PosOrderNotification;
  timeoutMs?: number;
};

export function showPosOrderPopup(detail: PosOrderPopupDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PosOrderPopupDetail>(HMS_POS_ORDER_EVENT, { detail }));
}

export function posOrderEventKey(row: PosOrderNotification): string {
  return `${row.eventId}:${row.eventType}:${row.at}`;
}
