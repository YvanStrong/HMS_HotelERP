import { apiFetch } from "./api";
import { publicFetch } from "./publicApi";

export type SelfOrderServiceType = "DINE_IN" | "TAKE_AWAY";

export type SelfOrderPaymentMode = "SIMULATED" | "PAY_AT_COUNTER";

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
};

export type TrackLineRow = {
  productName: string;
  productCode: string;
  quantity: number | string;
  lineTotal: number | string;
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
  lines: TrackLineRow[];
};

export type BoardOrderCard = {
  orderId: string;
  displayCode: string;
  serviceType: string;
  status: string;
  depotName: string;
  createdAt: string;
  lines: { productName: string; quantity: number | string }[];
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
  lines: TrackLineRow[];
};

export type StaffSelfOrderSettings = {
  orderBoardKeyConfigured: boolean;
  orderBoardSecretEcho?: string | null;
};

export function fetchSelfOrderMenu(hotelId: string): Promise<PublicMenuResponse> {
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order/menu`);
}

export function placeSelfOrder(
  hotelId: string,
  body: {
    serviceType: SelfOrderServiceType;
    depotId: string;
    lines: { productId: string; quantity: number }[];
    customerNote?: string | null;
    paymentMode: SelfOrderPaymentMode;
  },
): Promise<CreatePublicOrderResponse> {
  return publicFetch(`/api/v1/public/hotels/${hotelId}/self-order`, {
    method: "POST",
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

export function fetchStaffSelfOrderSettings(hotelId: string): Promise<StaffSelfOrderSettings> {
  return apiFetch(`/api/v1/hotels/${hotelId}/inventory/self-service-orders/settings`, { quiet: true });
}

export function putStaffSelfOrderSettings(
  hotelId: string,
  body: { orderBoardSecret?: string; clearBoardSecret?: boolean },
): Promise<StaffSelfOrderSettings> {
  return apiFetch(`/api/v1/hotels/${hotelId}/inventory/self-service-orders/settings`, {
    method: "PUT",
    body: JSON.stringify(body),
    quiet: true,
  });
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
