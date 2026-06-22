import { apiFetch } from "@/lib/api";

export type PosTableRow = {
  id: string;
  depotId?: string;
  depotName?: string;
  tableLabel: string;
  sortOrder: number;
  capacity: number;
  active: boolean;
  occupied: boolean;
  activeTicketId?: string | null;
  waiterName?: string | null;
};

export type TicketLineRow = {
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

export type TicketRow = {
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
  lineCount: number;
  currentRound: number;
  waiterName?: string | null;
  openedAt?: string;
  kitchenSentAt?: string | null;
  updatedAt: string;
  saleId?: string | null;
  saleNumber?: string | null;
  deliveryOrderId?: string | null;
  deliveryNumber?: string | null;
};

export type TicketDetail = TicketRow & {
  lines: TicketLineRow[];
  closedAt?: string | null;
};

export type KitchenTicketRow = {
  ticketId: string;
  tableLabel: string;
  depotName: string;
  status: string;
  updatedAt: string;
  lines: TicketLineRow[];
};

export type DepotRow = { id: string; name: string; code: string; active: boolean };

export function money(v: number | string | undefined | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

export async function fetchPosDepots(hotelId: string): Promise<DepotRow[]> {
  const rows = await apiFetch<DepotRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots`, { quiet: true });
  return (rows ?? []).filter((d) => d.active);
}

export async function fetchPosTables(
  hotelId: string,
  depotId?: string,
  includeInactive = false,
): Promise<PosTableRow[]> {
  const q = new URLSearchParams();
  if (depotId) q.set("depotId", depotId);
  if (includeInactive) q.set("includeInactive", "true");
  const qs = q.toString();
  return apiFetch<PosTableRow[]>(`/api/v1/hotels/${hotelId}/pos/tables${qs ? `?${qs}` : ""}`, { quiet: true });
}

export async function createPosTable(
  hotelId: string,
  body: { depotId: string; label: string; capacity: number; sortOrder?: number },
): Promise<PosTableRow> {
  return apiFetch<PosTableRow>(`/api/v1/hotels/${hotelId}/pos/tables`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePosTable(
  hotelId: string,
  tableId: string,
  body: { label?: string; capacity?: number; isActive?: boolean; sortOrder?: number },
): Promise<PosTableRow> {
  return apiFetch<PosTableRow>(`/api/v1/hotels/${hotelId}/pos/tables/${tableId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deactivatePosTable(hotelId: string, tableId: string): Promise<void> {
  await apiFetch(`/api/v1/hotels/${hotelId}/pos/tables/${tableId}`, { method: "DELETE" });
}

export async function fetchPosTicket(hotelId: string, ticketId: string): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}`, { quiet: true });
}

export async function cancelPosTicket(hotelId: string, ticketId: string): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/cancel`, {
    method: "POST",
  });
}

export async function fetchPosTickets(
  hotelId: string,
  depotId?: string,
  status = "OPEN",
): Promise<TicketRow[]> {
  const q = new URLSearchParams({ status });
  if (depotId) q.set("depotId", depotId);
  return apiFetch<TicketRow[]>(`/api/v1/hotels/${hotelId}/pos/tickets?${q}`, { quiet: true });
}

export async function fetchKitchenBoard(hotelId: string, depotId?: string): Promise<KitchenTicketRow[]> {
  const q = depotId ? `?depotId=${encodeURIComponent(depotId)}` : "";
  return apiFetch<KitchenTicketRow[]>(`/api/v1/hotels/${hotelId}/pos/kitchen-board${q}`, { quiet: true });
}

export async function markLineReady(hotelId: string, ticketId: string, lineId: string): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines/${lineId}/ready`,
    { method: "PATCH" },
  );
}

export async function markLineServed(hotelId: string, ticketId: string, lineId: string): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(
    `/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/lines/${lineId}/served`,
    { method: "PATCH" },
  );
}

export async function closeTicketInvoice(
  hotelId: string,
  ticketId: string,
  body: {
    mode: string;
    paymentMethod?: string;
    customerName?: string;
    chargeToRoom?: boolean;
    reservationId?: string;
  },
): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/api/v1/hotels/${hotelId}/pos/tickets/${ticketId}/close`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function minutesOpen(openedAt?: string | null): number {
  if (!openedAt) return 0;
  const ms = Date.now() - new Date(openedAt).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

export function urgencyClass(minutes: number): string {
  if (minutes < 20) return "border-emerald-200 bg-emerald-50/50";
  if (minutes <= 45) return "border-amber-200 bg-amber-50/50";
  return "border-red-200 bg-red-50/50";
}

export function formatElapsed(minutes: number): string {
  if (minutes < 1) return "just opened";
  if (minutes < 60) return `opened ${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `opened ${h}h ${m}m ago`;
}
