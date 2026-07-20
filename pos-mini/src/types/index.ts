import type { ProductTaxClass } from '../constants/productTax';

export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'credit' | 'split';
export type StaffRole = 'cashier' | 'manager';
export type ThemeMode = 'light' | 'dark';
export type DiscountMode = 'off' | 'rule' | 'manual';
export type SaleStatus = 'completed' | 'voided' | 'pending';
export type SaleRefundStatus = 'none' | 'partial' | 'refunded';
export type PurchaseStatus = 'completed' | 'pending' | 'cancelled';
export type RefundStatus = 'completed' | 'pending' | 'cancelled';
export type StockMovementType = 'sale' | 'purchase' | 'refund' | 'adjustment' | 'return';
export type DebtType = 'debt' | 'payment';
export type DiscountType = 'percent' | 'fixed';

import type { BusinessTypeId } from '../constants/businessTypes';

export interface BusinessSettings {
  id: number;
  businessName: string;
  businessType: BusinessTypeId;
  businessLogo: string | null;
  taxName: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  taxInclusive: boolean;
  receiptHeader: string;
  receiptFooter: string;
  pinEnabled: boolean;
  lowStockAlert: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  minStock: number;
  unit: string;
  taxClass: ProductTaxClass;
  isTaxable: boolean;
  taxRate: number;
  taxInclusive: boolean;
  imageUri: string | null;
  expiryDate: string | null;
  batchLot: string | null;
  trackStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  totalDebt: number;
  creditLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName?: string | null;
  staffId?: string | null;
  shiftId?: string | null;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  tipAmount: number;
  serviceCharge: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  refundStatus?: SaleRefundStatus;
  notes: string | null;
  tableId: string | null;
  tableName?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  modifiersJson?: string | null;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  lineTotal: number;
  discountAmount: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellPrice: number;
  costPrice: number;
  stockQty: number;
  isActive: boolean;
  createdAt: string;
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  options?: ModifierOption[];
}

export type SelectedModifier = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

export type KitchenTicketStatus = 'pending' | 'preparing' | 'done';

export interface KitchenTicket {
  id: string;
  saleId: string;
  invoiceNumber: string;
  status: KitchenTicketStatus;
  itemsJson: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  poNumber: string;
  supplierId: string | null;
  supplierName?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  status: PurchaseStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName: string;
  unitCost: number;
  quantity: number;
  lineTotal: number;
}

export interface Refund {
  id: string;
  refundNumber: string;
  saleId: string | null;
  saleInvoiceNumber?: string | null;
  subtotal: number;
  total: number;
  reason: string | null;
  status: RefundStatus;
  createdAt: string;
  updatedAt: string;
  items?: RefundItem[];
}

export interface RefundItem {
  id: string;
  refundId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  restock?: boolean;
  reasonCode?: string | null;
}

export interface SalePayment {
  id: string;
  saleId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  createdAt: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  notes: string | null;
  status: 'open' | 'closed';
}

export interface Staff {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  pinHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HeldCart {
  id: string;
  label: string | null;
  cartJson: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  movementType: StockMovementType;
  referenceType: string | null;
  referenceId: string | null;
  quantityChange: number;
  qtyBefore: number;
  qtyAfter: number;
  notes: string | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface DebtRecord {
  id: string;
  customerId: string;
  saleId: string | null;
  amount: number;
  type: DebtType;
  notes: string | null;
  createdAt: string;
}

export interface DiscountRule {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  minPurchase: number;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  lineKey: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  modifiers?: SelectedModifier[];
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discountAmount: number;
  unit: string;
  taxClass: ProductTaxClass;
  trackStock: boolean;
  stockQty: number;
  imageUri?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  isTaxable: boolean;
  taxRate: number;
  taxInclusive?: boolean;
}

export interface CartTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  serviceCharge: number;
  total: number;
  itemCount: number;
}

export interface HomeStats {
  todaySales: number;
  todayTransactions: number;
  lowStockCount: number;
  totalProducts: number;
}

export interface ProductBundleItem {
  id: string;
  parentProductId: string;
  childProductId: string;
  childProductName?: string;
  quantity: number;
  createdAt: string;
}

export type TableStatus = 'available' | 'occupied' | 'merged';

export interface PosTable {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  mergedIntoId: string | null;
  openBillTotal?: number;
  openBillId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NumberSequence {
  prefix: string;
  lastNumber: number;
}

export type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'categoryName'>;
export type UpdateProductInput = Partial<CreateProductInput>;

export type SalePaymentInput = {
  paymentMethod: Exclude<PaymentMethod, 'split'>;
  amount: number;
};

export type CreateSaleItemInput = Omit<SaleItem, 'id' | 'saleId'>;

export type CreateSaleInput = {
  customerId?: string | null;
  staffId?: string | null;
  shiftId?: string | null;
  items: CreateSaleItemInput[];
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  tipAmount?: number;
  serviceCharge?: number;
  subtotal: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  payments?: SalePaymentInput[];
  tableId?: string | null;
  existingSaleId?: string | null;
  status?: Sale['status'];
};

export type CreateProductVariantInput = Omit<ProductVariant, 'id' | 'createdAt'>;
export type UpdateProductVariantInput = Partial<Omit<CreateProductVariantInput, 'productId'>>;

export type CreateModifierGroupInput = Omit<ModifierGroup, 'id' | 'createdAt' | 'options'>;
export type CreateModifierOptionInput = Omit<ModifierOption, 'id' | 'groupId' | 'isActive'> & {
  groupId: string;
};

export type CreatePurchaseInput = {
  supplierId?: string | null;
  items: Omit<PurchaseItem, 'id' | 'purchaseId'>[];
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  notes?: string | null;
};

export type CreateRefundInput = {
  saleId?: string | null;
  items: Omit<RefundItem, 'id' | 'refundId'>[];
  subtotal: number;
  total: number;
  reason?: string | null;
};

export type StockAdjustmentInput = {
  productId: string;
  quantityChange: number;
  notes?: string | null;
};
