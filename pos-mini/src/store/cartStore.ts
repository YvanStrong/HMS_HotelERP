import { create } from 'zustand';
import type { CartItem, CartTotals, DiscountMode, DiscountType, PaymentMethod, SalePaymentInput } from '../types';
import {
  calculateChange,
  calculateDiscountAmount,
  calculateLineTotal,
  calculateSubtotal,
  calculateCartTax,
  calculateTotal,
  roundMoney,
} from '../utils/calculations';
import { useAppStore } from './appStore';
import { normalizeProductTaxClass } from '../constants/productTax';

type CartState = {
  items: CartItem[];
  customerId: string | null;
  discountMode: DiscountMode;
  discountPercent: number;
  fixedDiscount: number;
  manualDiscountType: DiscountType;
  manualDiscountValue: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  notes: string;
  splitEnabled: boolean;
  splitPayments: SalePaymentInput[];
  addItem: (item: Omit<CartItem, 'quantity' | 'discountAmount'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setCustomer: (customerId: string | null) => void;
  setDiscountMode: (mode: DiscountMode) => void;
  setDiscountPercent: (percent: number) => void;
  setFixedDiscount: (amount: number) => void;
  setManualDiscount: (type: DiscountType, value: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setAmountPaid: (amount: number) => void;
  setNotes: (notes: string) => void;
  setSplitEnabled: (enabled: boolean) => void;
  setSplitPayments: (payments: SalePaymentInput[]) => void;
  addSplitPayment: (payment: SalePaymentInput) => void;
  removeSplitPayment: (index: number) => void;
  loadSnapshot: (snapshot: Partial<CartState>) => void;
  getSnapshot: () => string;
  clear: () => void;
  getTotals: () => CartTotals & { change: number };
  toSaleItems: () => {
    productId: string;
    productName: string;
    unitPrice: number;
    costPrice: number;
    quantity: number;
    lineTotal: number;
    discountAmount: number;
  }[];
};

const initialState = {
  items: [] as CartItem[],
  customerId: null as string | null,
  discountMode: 'off' as DiscountMode,
  discountPercent: 0,
  fixedDiscount: 0,
  manualDiscountType: 'percent' as DiscountType,
  manualDiscountValue: 0,
  paymentMethod: 'cash' as PaymentMethod,
  amountPaid: 0,
  notes: '',
  splitEnabled: false,
  splitPayments: [] as SalePaymentInput[],
};

export const useCartStore = create<CartState>((set, get) => ({
  ...initialState,

  addItem: (item) => {
    const items = [...get().items];
    const idx = items.findIndex((i) => i.productId === item.productId);
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        quantity: items[idx].quantity + (item.quantity ?? 1),
      };
    } else {
      items.push({
        ...item,
        quantity: item.quantity ?? 1,
        discountAmount: 0,
      });
    }
    set({ items });
  },

  removeItem: (productId) => {
    set({ items: get().items.filter((i) => i.productId !== productId) });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    });
  },

  setCustomer: (customerId) => set({ customerId }),
  setDiscountMode: (mode) => {
    if (mode === 'off') {
      set({ discountMode: mode, discountPercent: 0, fixedDiscount: 0, manualDiscountValue: 0 });
    } else {
      set({ discountMode: mode });
    }
  },
  setDiscountPercent: (percent) => set({ discountPercent: Math.max(0, percent) }),
  setFixedDiscount: (amount) => set({ fixedDiscount: Math.max(0, amount) }),
  setManualDiscount: (type, value) =>
    set({
      manualDiscountType: type,
      manualDiscountValue: Math.max(0, value),
      discountPercent: type === 'percent' ? value : 0,
      fixedDiscount: type === 'fixed' ? value : 0,
    }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setAmountPaid: (amount) => set({ amountPaid: Math.max(0, amount) }),
  setNotes: (notes) => set({ notes }),
  setSplitEnabled: (enabled) =>
    set({ splitEnabled: enabled, splitPayments: enabled ? get().splitPayments : [] }),
  setSplitPayments: (payments) => set({ splitPayments: payments }),
  addSplitPayment: (payment) => set({ splitPayments: [...get().splitPayments, payment] }),
  removeSplitPayment: (index) =>
    set({ splitPayments: get().splitPayments.filter((_, i) => i !== index) }),

  loadSnapshot: (snapshot) => {
    set({
      ...initialState,
      ...snapshot,
      items: (snapshot.items ?? []).map((item) => ({
        ...item,
        unit: item.unit ?? 'pcs',
        taxClass: normalizeProductTaxClass(item.taxClass),
      })),
      splitPayments: snapshot.splitPayments ?? [],
    });
  },

  getSnapshot: () => {
    const { items, customerId, discountMode, discountPercent, fixedDiscount, manualDiscountType, manualDiscountValue, paymentMethod, amountPaid, notes, splitEnabled, splitPayments } = get();
    return JSON.stringify({
      items,
      customerId,
      discountMode,
      discountPercent,
      fixedDiscount,
      manualDiscountType,
      manualDiscountValue,
      paymentMethod,
      amountPaid,
      notes,
      splitEnabled,
      splitPayments,
    });
  },

  clear: () => set({ ...initialState }),

  getTotals: () => {
    const { items, discountMode, discountPercent, fixedDiscount, amountPaid } = get();
    const settings = useAppStore.getState().settings;
    const subtotal = roundMoney(calculateSubtotal(items));
    const discountAmount =
      discountMode === 'off'
        ? 0
        : roundMoney(calculateDiscountAmount(subtotal, discountPercent, fixedDiscount));
    const taxAmount = roundMoney(
      calculateCartTax(items, discountAmount, settings?.taxInclusive ?? false),
    );
    const total = roundMoney(
      calculateTotal(subtotal, discountAmount, taxAmount, settings?.taxInclusive ?? false),
    );
    const change = roundMoney(calculateChange(amountPaid, total));
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    return { subtotal, discountAmount, taxAmount, total, itemCount, change };
  },

  toSaleItems: () => {
    return get().items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      quantity: item.quantity,
      lineTotal: roundMoney(calculateLineTotal(item.unitPrice, item.quantity, item.discountAmount)),
      discountAmount: item.discountAmount,
    }));
  },
}));

