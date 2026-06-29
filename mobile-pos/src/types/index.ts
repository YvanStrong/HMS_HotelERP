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
  stockQty?: number | string | null;
  stockType?: string | null;
  /** When false, stock is not tracked and badges are hidden. */
  isTracked?: boolean;
  photoUrl?: string | null;
  menuName: string;
  taxable: boolean;
  active: boolean;
  inventoryItemId?: string | null;
  allergens?: string[];
  dietaryFlags?: string[];
  nameTranslations?: Record<string, string> | null;
};

export type CartLine = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  notes?: string;
  imageUrl?: string | null;
  taxable?: boolean;
  isHeld?: boolean;
  holdCourse?: "STARTER" | "MAIN" | "DESSERT";
  allergens?: string[];
  dietaryFlags?: string[];
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

export type ReservationHint = {
  reservationId: string;
  guestName: string;
  guestCount: number;
  roomNumber?: string | null;
  dietaryNotes?: string | null;
  specialRequests?: string | null;
  checkInTime: string;
};

export type PaymentMethod = "CASH" | "CARD";

export type VoidLineRequest = {
  reason: string;
  managerPin: string;
};

export type LineDiscountRequest = {
  discountType: "PERCENT" | "AMOUNT";
  discountValue: number;
  reason: string;
  managerPin: string;
};

export type PosLineAudit = {
  id: string;
  ticketId: string;
  lineId: string;
  action: "VOID" | "DISCOUNT";
  productName?: string;
  tableLabel?: string;
  waiterName?: string;
  originalPrice: number | string;
  originalQty: number;
  discountPct?: number | string | null;
  discountAmount?: number | string | null;
  reason: string;
  authorizedBy: string;
  authorizedByName: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
};
