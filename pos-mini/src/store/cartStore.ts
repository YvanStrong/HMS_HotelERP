import { create } from 'zustand';

import type { CartItem, CartTotals, DiscountMode, DiscountType, PaymentMethod, SalePaymentInput, SelectedModifier } from '../types';

import {

  calculateChange,

  calculateDiscountAmount,

  calculateCartTax,

  calculateCartTotal,

  calculateLineTotal,

  calculateSubtotal,

  cartItemsToTaxableLines,

  roundMoney,

} from '../utils/calculations';

import { buildCartLineKey } from '../utils/cartLineKey';



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

  addItem: (

    item: Omit<CartItem, 'quantity' | 'discountAmount' | 'lineKey'> & { quantity?: number },

  ) => void;

  removeItem: (lineKey: string) => void;

  updateQuantity: (lineKey: string, quantity: number) => void;

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

    variantId?: string | null;

    variantName?: string | null;

    modifiersJson?: string | null;

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

    const lineKey = buildCartLineKey(item.productId, item.variantId, item.modifiers);

    const items = [...get().items];

    const idx = items.findIndex((i) => i.lineKey === lineKey);

    if (idx >= 0) {

      items[idx] = {

        ...items[idx],

        quantity: items[idx].quantity + (item.quantity ?? 1),

      };

    } else {

      items.push({

        ...item,

        lineKey,

        quantity: item.quantity ?? 1,

        discountAmount: 0,

      });

    }

    set({ items });

  },



  removeItem: (lineKey) => {

    set({ items: get().items.filter((i) => i.lineKey !== lineKey) });

  },



  updateQuantity: (lineKey, quantity) => {

    if (quantity <= 0) {

      get().removeItem(lineKey);

      return;

    }

    set({

      items: get().items.map((i) => (i.lineKey === lineKey ? { ...i, quantity } : i)),

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

        lineKey: item.lineKey ?? buildCartLineKey(item.productId, item.variantId, item.modifiers),

        isTaxable: item.isTaxable ?? false,

        taxRate: item.taxRate ?? 0,

        taxInclusive: item.taxInclusive ?? false,

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

    const subtotal = roundMoney(calculateSubtotal(items));

    const discountAmount =

      discountMode === 'off'

        ? 0

        : roundMoney(calculateDiscountAmount(subtotal, discountPercent, fixedDiscount));

    const taxableLines = cartItemsToTaxableLines(items);

    const taxAmount = roundMoney(calculateCartTax(taxableLines, discountAmount));

    const total = roundMoney(calculateCartTotal(taxableLines, discountAmount));

    const change = roundMoney(calculateChange(amountPaid, total));

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);



    return { subtotal, discountAmount, taxAmount, total, itemCount, change };

  },



  toSaleItems: () => {

    return get().items.map((item) => ({

      productId: item.productId,

      productName: item.productName,

      variantId: item.variantId ?? null,

      variantName: item.variantName ?? null,

      modifiersJson: item.modifiers?.length ? JSON.stringify(item.modifiers) : null,

      unitPrice: item.unitPrice,

      costPrice: item.costPrice,

      quantity: item.quantity,

      lineTotal: roundMoney(calculateLineTotal(item.unitPrice, item.quantity, item.discountAmount)),

      discountAmount: item.discountAmount,

    }));

  },

}));


