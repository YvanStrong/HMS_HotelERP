import type { SelfOrderServiceType } from "@/lib/selfOrderApi";

export function trackStorageKey(hotelId: string) {
  return `hms_self_order_track_${hotelId}`;
}

export function menuItemMatchesService(menuName: string | undefined, st: SelfOrderServiceType): boolean {
  const raw = (menuName ?? "").toUpperCase().replace(/\s+/g, "_");
  const dine = raw.includes("DINE_IN") || raw.includes("DINEIN");
  const take =
    raw.includes("TAKE_AWAY") || raw.includes("TAKEAWAY") || raw.includes("TAKE_OUT") || raw.includes("PICKUP");
  if (dine && take) return true;
  if (dine && !take) return st === "DINE_IN";
  if (take && !dine) return st === "TAKE_AWAY";
  return true;
}

export function formatMoney(currency: string, n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatRevenueShort(currency: string, total: number): string {
  if (!Number.isFinite(total)) return "—";
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
  return formatMoney(currency, total);
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function adminStatusLabel(status: string): string {
  switch (status) {
    case "PLACED":
      return "New";
    case "IN_PROGRESS":
      return "Preparing";
    case "READY":
      return "Ready";
    default:
      return status.replace(/_/g, " ");
  }
}
