import type { TicketDetail } from "../api/tickets";
import { money } from "../api/tickets";
import { mmkvGetString, mmkvSetString } from "./mmkv";

const LAST_RECEIPT_KEY = "last_closed_ticket";

export type ClosedTicketSummary = {
  ticketId: string;
  tableLabel: string;
  waiterName?: string | null;
  lines: {
    productName: string;
    quantity: number | string;
    lineTotal: number | string;
  }[];
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  paymentMethod?: string | null;
  saleId?: string | null;
  saleNumber?: string | null;
  closedAt: string;
  depotName: string;
};

export function buildClosedSummary(
  ticket: TicketDetail,
  depotName: string,
  paymentMethod?: string | null,
): ClosedTicketSummary {
  const activeLines = ticket.lines.filter((l) => !l.voided && l.lineStatus !== "CANCELLED");
  return {
    ticketId: ticket.id,
    tableLabel: ticket.tableLabel,
    waiterName: ticket.waiterName,
    lines: activeLines.map((l) => ({
      productName: l.productName,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
    })),
    subtotal: ticket.subtotal,
    taxAmount: ticket.taxAmount,
    totalAmount: ticket.totalAmount,
    paymentMethod: paymentMethod ?? null,
    saleId: ticket.saleId ?? null,
    saleNumber: ticket.saleNumber ?? null,
    closedAt: ticket.closedAt ?? new Date().toISOString(),
    depotName,
  };
}

export function closedSummaryToTicketDetail(summary: ClosedTicketSummary): TicketDetail {
  return {
    id: summary.ticketId,
    depotId: "",
    depotName: summary.depotName,
    tableLabel: summary.tableLabel,
    status: "CLOSED",
    subtotal: summary.subtotal,
    taxAmount: summary.taxAmount,
    totalAmount: summary.totalAmount,
    currentRound: 1,
    closedAt: summary.closedAt,
    waiterName: summary.waiterName,
    saleId: summary.saleId,
    saleNumber: summary.saleNumber,
    lines: summary.lines.map((l, i) => ({
      id: `reprint-${i}`,
      productId: `reprint-${i}`,
      productName: l.productName,
      quantity: l.quantity,
      unitPrice: money(l.lineTotal) / Math.max(1, money(l.quantity)),
      lineTotal: l.lineTotal,
      lineStatus: "SERVED",
      taxable: true,
      round: 1,
    })),
  };
}

export function loadLastClosedTicket(): ClosedTicketSummary | null {
  const raw = mmkvGetString(LAST_RECEIPT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClosedTicketSummary;
  } catch {
    return null;
  }
}

export function saveLastClosedTicket(summary: ClosedTicketSummary): void {
  mmkvSetString(LAST_RECEIPT_KEY, JSON.stringify(summary));
}
