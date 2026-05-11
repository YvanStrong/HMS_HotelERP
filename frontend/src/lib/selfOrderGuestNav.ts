/**
 * Single source of truth for public self-order guest routes and labels.
 * Add entries here only — UI (sidebar) maps over this list.
 */

export type SelfOrderGuestNavId = "menu" | "status" | "kitchen" | "pickup";

export type SelfOrderGuestNavDef = {
  id: SelfOrderGuestNavId;
  /** Path segment under /book/order/[hotelId]/ — empty = menu root */
  segment: "" | "status" | "kitchen" | "pickup" | "services";
  label: string;
};

/** Ordered guest-facing sections (sidebar / nav). */
export const SELF_ORDER_GUEST_NAV: readonly SelfOrderGuestNavDef[] = [
  { id: "menu", segment: "", label: "Customer menu" },
  { id: "status", segment: "status", label: "Order status" },
  { id: "pickup", segment: "pickup", label: "Pickup board" },
  { id: "kitchen", segment: "kitchen", label: "Kitchen display" },
] as const;

export type GuestOrderQuery = {
  table?: string | null;
  key?: string | null;
};

/** Preserve QR / board query params on every guest self-order link. */
export function buildGuestSelfOrderHref(
  hotelId: string,
  segment: SelfOrderGuestNavDef["segment"],
  query: GuestOrderQuery,
): string {
  const path = segment ? `/book/order/${hotelId}/${segment}` : `/book/order/${hotelId}`;
  const q = new URLSearchParams();
  const t = query.table?.trim();
  const k = query.key?.trim();
  if (t) q.set("table", t);
  if (k) q.set("key", k);
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

export function guestNavActivePath(pathname: string, hotelId: string, segment: SelfOrderGuestNavDef["segment"]): boolean {
  const base = `/book/order/${hotelId}`;
  if (segment === "") {
    return pathname === base || pathname === `${base}/`;
  }
  return pathname === `${base}/${segment}` || pathname.startsWith(`${base}/${segment}/`);
}
