import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PosShiftDTO } from "../api/shifts";
import { mmkvStorage } from "../storage/mmkv";

type ShiftState = {
  activeShift: PosShiftDTO | null;
  isShiftOpen: boolean;
  setActiveShift: (shift: PosShiftDTO | null) => void;
  clearShift: () => void;
};

export const useShiftStore = create<ShiftState>()(
  persist(
    (set) => ({
      activeShift: null,
      isShiftOpen: false,
      setActiveShift: (shift) => {
        if (!shift) {
          set({ activeShift: null, isShiftOpen: false });
          return;
        }
        const openedAt = shift.openedAt || new Date().toISOString();
        set({
          activeShift: { ...shift, openedAt },
          isShiftOpen: shift.status === "OPEN",
        });
      },
      clearShift: () => set({ activeShift: null, isShiftOpen: false }),
    }),
    {
      name: "hms_shift_store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (s) => ({ activeShift: s.activeShift, isShiftOpen: s.isShiftOpen }),
    },
  ),
);
