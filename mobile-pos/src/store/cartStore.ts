import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartLine, Depot, DepotProduct } from "../types";
import { getTaxRate } from "../api/settings";
import { productPrice } from "../api/menu";
import { mmkvStorage } from "../storage/mmkv";



type CartState = {

  selectedDepot: Depot | null;

  tableLabel: string | null;

  tableId: string | null;

  ticketId: string | null;

  ticketStatus: string | null;

  currentRound: number;

  lines: CartLine[];

  setDepot: (depot: Depot) => void;

  setTable: (label: string, tableId?: string | null) => void;

  setActiveTicket: (ticketId: string, status?: string, round?: number) => void;

  setTicketId: (ticketId: string | null) => void;

  addItem: (product: DepotProduct, note?: string, hold?: { isHeld?: boolean; holdCourse?: CartLine["holdCourse"] }) => void;

  removeItem: (productId: string) => void;

  updateQty: (productId: string, qty: number) => void;

  setNote: (productId: string, note: string) => void;

  clearPendingLines: () => void;

  clearCart: () => void;

  clearTicket: () => void;

  subtotal: () => number;

  tax: () => number;

  total: () => number;

  itemCount: () => number;

};



export const useCartStore = create<CartState>()(

  persist(

    (set, get) => ({

      selectedDepot: null,

      tableLabel: null,

      tableId: null,

      ticketId: null,

      ticketStatus: null,

      currentRound: 1,

      lines: [],



      setDepot: (depot) =>

        set({ selectedDepot: depot, ticketId: null, ticketStatus: null, currentRound: 1, lines: [] }),



      setTable: (label, tableId = null) =>

        set({ tableLabel: label, tableId, ticketId: null, ticketStatus: null, currentRound: 1, lines: [] }),



      setActiveTicket: (ticketId, status, round) =>

        set({

          ticketId,

          ticketStatus: status ?? "OPEN",

          currentRound: round ?? get().currentRound,

        }),



      setTicketId: (ticketId) => set({ ticketId }),



      addItem: (product, note, hold) => {
        const price = productPrice(product);
        const lines = [...get().lines];
        const idx = lines.findIndex((l) => l.productId === product.id && !!l.isHeld === !!hold?.isHeld);
        if (idx >= 0 && !hold?.isHeld) {
          lines[idx] = {
            ...lines[idx],
            qty: lines[idx].qty + 1,
            notes: note ?? lines[idx].notes,
          };
        } else {
          lines.push({
            productId: product.id,
            productName: product.productName,
            qty: 1,
            unitPrice: price,
            notes: note,
            imageUrl: product.photoUrl,
            taxable: product.taxable,
            isHeld: hold?.isHeld ?? false,
            holdCourse: hold?.holdCourse,
            allergens: product.allergens,
            dietaryFlags: product.dietaryFlags,
          });
        }
        set({ lines });
      },



      removeItem: (productId) => {

        set({ lines: get().lines.filter((l) => l.productId !== productId) });

      },



      updateQty: (productId, qty) => {

        if (qty <= 0) {

          get().removeItem(productId);

          return;

        }

        set({

          lines: get().lines.map((l) => (l.productId === productId ? { ...l, qty } : l)),

        });

      },



      setNote: (productId, note) => {

        set({

          lines: get().lines.map((l) => (l.productId === productId ? { ...l, notes: note } : l)),

        });

      },



      clearPendingLines: () => set({ lines: [] }),



      clearCart: () =>

        set({

          lines: [],

          tableLabel: null,

          tableId: null,

          ticketId: null,

          ticketStatus: null,

          currentRound: 1,

        }),



      clearTicket: () =>

        set({

          ticketId: null,

          ticketStatus: null,

          currentRound: 1,

          lines: [],

        }),



      subtotal: () => get().lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),



      tax: () => {

        const rate = getTaxRate();

        const taxable = get()

          .lines.filter((l) => l.taxable !== false)

          .reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

        return taxable * rate;

      },



      total: () => get().subtotal() + get().tax(),



      itemCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),

    }),

    {

      name: "hms-cart-store",

      storage: createJSONStorage(() => mmkvStorage),

      partialize: (s) => ({

        selectedDepot: s.selectedDepot,

        tableLabel: s.tableLabel,

        tableId: s.tableId,

        ticketId: s.ticketId,

        ticketStatus: s.ticketStatus,

        currentRound: s.currentRound,

        lines: s.lines,

      }),

    },

  ),

);

