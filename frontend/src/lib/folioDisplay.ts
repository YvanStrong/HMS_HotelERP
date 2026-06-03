/** Shared folio display helpers for staff folio / guest bill pages. */

export type FolioChargeRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  quantity?: number;
  postedBy?: string;
  originating_reservation_id?: string | null;
};

export type FolioSummaryBlock = {
  reservation_id?: string;
  room_charges_total?: number;
  other_charges_total?: number;
  gross_total?: number;
  tax_total?: number;
  discount_total?: number;
  grand_total?: number;
  deposit_credit?: number;
  payments_total?: number;
  balanceDue?: number;
  balance_due?: number;
  currency: string;
};

export type FolioPaymentRow = {
  id: string | null;
  postedAt: string;
  method: string;
  amount: number;
  type?: string;
  status?: string;
  reference?: string | null;
  notes?: string | null;
};

export type FolioLedgerRow = {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  debit_credit: string;
  reference?: string | null;
  createdAt: string;
};

export type StaffFolio = {
  reservationId: string;
  confirmationCode?: string;
  booking_reference?: string;
  billing_route_note?: string | null;
  guest: { name: string; email?: string | null };
  stay?: {
    checkIn: string;
    checkOut: string;
    reservationStatus: string;
    totalNights: number;
  };
  charges: FolioChargeRow[];
  summary: FolioSummaryBlock;
  payments: FolioPaymentRow[];
  ledger?: FolioLedgerRow[];
};

export function folioBalance(f: StaffFolio): number {
  const v = f.summary.balanceDue ?? f.summary.balance_due;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function folioTaxLabel(summary: FolioSummaryBlock): string {
  const gross = Number(summary.gross_total ?? 0);
  const tax = Number(summary.tax_total ?? 0);
  if (gross > 0.0001 && tax >= 0) {
    const pct = Math.round((tax / gross) * 1000) / 10;
    if (Number.isFinite(pct) && pct > 0) {
      return `Tourism Tax (TT) (${pct}%)`;
    }
  }
  return "Tourism Tax (TT)";
}

export function formatFolioInstant(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

export function formatMoney(amount: number | undefined | null, currency: string): string {
  const n = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return `${n.toFixed(2)} ${currency}`;
}
