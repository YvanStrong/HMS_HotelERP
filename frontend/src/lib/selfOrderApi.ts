import { apiFetch } from "./api";
import { publicFetch } from "./publicApi";

export type SelfOrderServiceType = "DINE_IN" | "TAKE_AWAY";

export type SelfOrderPaymentMode = "SIMULATED" | "PAY_AT_COUNTER" | "CHARGE_ROOM";

export type PublicDepotBrief = { id: string; name: string };

export type PublicMenuItem = {
  id: string;
  depotId: string;
  depotName: string;
  productName: string;
  productCode: string;
  sellingPrice: number;
  photoUrl?: string | null;
  menuName: string;
  stockType: string;
  stockQty: number;
  active: boolean;
};

export type PublicMenuResponse = {
  currency: string;
  orderBoardKeyConfigured: boolean;
  depots: PublicDepotBrief[];
  items: PublicMenuItem[];
  /** Hotel display name for guest-facing headers (QR / kiosk). */
  hotelName?: string | null;
  /** Tenant: SMS on READY allowed (still requires global Twilio config server-side). */
  selfOrderSmsEnabled?: boolean;
  /** Tenant: Web Push subscribe allowed when VAPID is configured. */
  selfOrderPushEnabled?: boolean;
};

export type PublicActiveOrderBrief = {
  displayCode: string;
  status: string;
  lineSummary: string;
  pickupDisplayName?: string | null;
};

export type PublicPortalSummary = {
  todayOrderCount: number;
  todayRevenueTotal: number | string;
  avgFulfillmentMinutes: number | null;
  activeOrders: PublicActiveOrderBrief[];
};

export type PlacedOrderRef = {
  trackToken: string;
  displayCode: string;
  orderNumber: string;
  depotName: string;
};

export type CreatePublicOrderResponse = {
  orderId: string;
  orderNumber: string;
  displayCode: string;
  trackToken: string;
  serviceType: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalAmount: number;
  createdAt: string;
  message: string;
  /** Extra outlet tickets from the same checkout (same payment / folio). */
  siblingOrders?: PlacedOrderRef[] | null;
  pickupDisplayName?: string | null;
  pickupLocation?: string | null;
};

export type TrackLineRow = {
  productName: string;
  productCode: string;
  quantity: number | string;
  lineTotal: number | string;
  modifiersNote?: string | null;
  photoUrl?: string | null;
};

export type TrackOrderResponse = {
  orderId: string;
  orderNumber: string;
  displayCode: string;
  serviceType: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  depotName: string;
  totalAmount: number | string;
  createdAt: string;
  updatedAt: string;
  customerNote?: string | null;
  pickupDisplayName?: string | null;
  pickupLocation?: string | null;
  lines: TrackLineRow[];
};

export type BoardOrderCard = {
  orderId: string;
  displayCode: string;
  serviceType: string;
  status: string;
  depotName: string;
  createdAt: string;
  pickupDisplayName?: string | null;
  pickupLocation?: string | null;
  lines: {
    productName: string;
    quantity: number | string;
    modifiersNote?: string | null;
    photoUrl?: string | null;
  }[];
};

export type BoardResponse = { orders: BoardOrderCard[] };

export type StaffOrderRow = {
  orderId: string;
  orderNumber: string;
  displayCode: string;
  serviceType: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  depotName: string;
  totalAmount: number | string;
  createdAt: string;
  updatedAt: string;
  pickupDisplayName?: string | null;
  pickupLocation?: string | null;
  lastNotifyAt?: string | null;
  lastNotifyStatus?: string | null;
  lastNotifyDetail?: string | null;
  lines: TrackLineRow[];
};

/** Rolling “today” (hotel timezone) counts from self_order_events. */
export type SelfOrderHealthSnapshot = {
  windowStartUtc: string;
  totalEvents: number;
  ordersPlaced: number;
  notifySmsOk: number;
  notifySmsFail: number;
  notifyPushOk: number;
  notifyPushFail: number;
};

export type WebPushPublicConfigResponse = {
  configured: boolean;
  publicKey: string | null;
  subject: string | null;
};

export type StaffSelfOrderSettings = {
  orderBoardKeyConfigured: boolean;
  orderBoardSecretEcho?: string | null;
  /** When true, public pickup-board API omits guest names; kitchen board unchanged. */
  pickupBoardHideGuestNames: boolean;
  selfOrderSmsEnabled: boolean;
  selfOrderPushEnabled: boolean;
};

export function fetchSelfOrderMenu(hotelId: string): Promise<PublicMenuResponse> {
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/menu`);
}

/** Must match server default when phone is set; bump when guest copy changes. */
export const SELF_ORDER_SMS_CONSENT_VERSION = "1";

export function placeSelfOrder(
  hotelId: string,
  body: {
    serviceType: SelfOrderServiceType;
    /** Omit when the cart spans multiple outlets; server splits into one ticket per outlet. */
    depotId?: string;
    lines: { productId: string; quantity: number; modifiersNote?: string | null }[];
    customerNote?: string | null;
    paymentMode: SelfOrderPaymentMode;
    room_charge?: { roomNumber: string; bookingCode: string };
    pickup_display_name?: string | null;
    pickup_location?: string | null;
    sms_notify_phone?: string | null;
    sms_consent_accepted?: boolean;
    sms_consent_version?: string;
  },
  opts?: { idempotencyKey?: string },
): Promise<CreatePublicOrderResponse> {
  const headers: HeadersInit = {};
  if (opts?.idempotencyKey?.trim()) {
    headers["Idempotency-Key"] = opts.idempotencyKey.trim();
  }
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export function fetchSelfOrderTrack(hotelId: string, trackToken: string): Promise<TrackOrderResponse> {
  const q = new URLSearchParams({ token: trackToken });
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/track?${q.toString()}`);
}

export function fetchSelfOrderBoard(hotelId: string, boardKey?: string | null): Promise<BoardResponse> {
  const q = new URLSearchParams();
  if (boardKey) q.set("key", boardKey);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/board${suffix}`);
}

export function fetchSelfOrderPickupBoard(hotelId: string, boardKey?: string | null): Promise<BoardResponse> {
  const q = new URLSearchParams();
  if (boardKey) q.set("key", boardKey);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/pickup-board${suffix}`);
}

export function fetchSelfOrderWebPushConfig(hotelId: string): Promise<WebPushPublicConfigResponse> {
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/web-push-config`);
}

export function subscribeSelfOrderPush(
  hotelId: string,
  body: { trackToken: string; endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/push-subscribe`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchSelfOrderPortalSummary(hotelId: string): Promise<PublicPortalSummary> {
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/portal-summary`);
}

export function fetchStaffSelfOrderSettings(hotelId: string): Promise<StaffSelfOrderSettings> {
  return apiFetch(`/api/v1/hotels/${hotelId}/inventory/self-service-orders/settings`, { quiet: true });
}

export function putStaffSelfOrderSettings(
  hotelId: string,
  body: {
    orderBoardSecret?: string;
    clearBoardSecret?: boolean;
    pickupBoardHideGuestNames?: boolean;
    selfOrderSmsEnabled?: boolean;
    selfOrderPushEnabled?: boolean;
  },
): Promise<StaffSelfOrderSettings> {
  return apiFetch(`/api/v1/hotels/${hotelId}/inventory/self-service-orders/settings`, {
    method: "PUT",
    body: JSON.stringify(body),
    quiet: true,
  });
}

export function fetchStaffSelfOrderHealth(hotelId: string): Promise<SelfOrderHealthSnapshot> {
  return apiFetch(`/api/v1/hotels/${hotelId}/inventory/self-service-orders/health`, { quiet: true });
}

export function confirmSelfOrderPayment(
  hotelId: string,
  orderId: string,
  paymentMethod: string,
): Promise<StaffOrderRow> {
  return apiFetch(`/api/v1/hotels/${hotelId}/inventory/self-service-orders/${orderId}/confirm-payment`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod }),
    quiet: true,
  });
}
