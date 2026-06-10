export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  hotelId: string | null;
  permissions: string[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: AuthUser;
};

export type Depot = {
  id: string;
  name: string;
  code: string;
  depotType: string;
  active: boolean;
  warehouseId?: string | null;
};

export type DepotProduct = {
  id: string;
  depotId: string;
  productName: string;
  productCode: string;
  sellingPrice: number | string;
  stockQty?: number | string;
  photoUrl?: string | null;
  menuName: string;
  taxable: boolean;
  active: boolean;
  inventoryItemId?: string | null;
};

export type CartLine = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  notes?: string;
  imageUrl?: string | null;
  taxable?: boolean;
};

export type SaleLineInput = {
  productId: string;
  quantity: number;
  notes?: string;
};

export type CreateSaleRequest = {
  customerName?: string;
  depotId: string;
  lines: SaleLineInput[];
  chargeToRoom?: boolean;
  reservationId?: string;
  paymentMethod?: string;
  tableLabel?: string;
  staffId?: string;
};

export type CreateSaleResponse = {
  saleId: string;
  saleNumber: string;
  depotId: string;
  totalAmount: number | string;
  soldAt: string;
  roomChargeId?: string | null;
  message: string;
};

export type CreateDeliveryRequest = {
  customerName?: string;
  locationLabel?: string;
  depotId: string;
  lines: SaleLineInput[];
  staffId?: string;
};

export type CreateDeliveryResponse = {
  deliveryOrderId: string;
  deliveryNumber: string;
  depotId: string;
  totalAmount: number | string;
  createdAt: string;
  message: string;
};

export type GuestSearchHit = {
  guest: {
    id: string;
    full_name?: string;
    fullName?: string;
    email?: string | null;
    phone?: string | null;
  };
};

export type ReservationListItem = {
  id: string;
  confirmationCode?: string;
  booking_reference?: string;
  status: string;
  guestName: string;
  roomNumber?: string | null;
};

export type PaymentMethod = "CASH" | "CARD";
