import { create } from 'zustand';
import type { BusinessSettings, HomeStats, Staff, ThemeMode } from '../types';
import { initDatabase } from '../db/database';
import { countLowStock, countProducts } from '../repositories/productRepository';
import {
  getBusinessSettings,
  isBusinessSetupComplete,
  saveBusinessSettings,
} from '../repositories/settingsRepository';
import { getTodaySalesStats } from '../repositories/saleRepository';
import { getCurrentStaffId, getThemeSettings, setCurrentStaffId } from '../repositories/metaRepository';
import { getStaffById } from '../repositories/staffRepository';
import { hasPinSet } from '../utils/pin';

type AppState = {
  isReady: boolean;
  isSetupComplete: boolean;
  isUnlocked: boolean;
  pinRequired: boolean;
  settings: BusinessSettings | null;
  stats: HomeStats;
  themeMode: ThemeMode;
  currentStaff: Staff | null;
  init: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshTheme: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  setCurrentStaff: (staff: Staff | null) => Promise<void>;
  updateSettings: (input: Partial<BusinessSettings>) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  unlock: () => void;
  lock: () => void;
};

const defaultStats: HomeStats = {
  todaySales: 0,
  todayTransactions: 0,
  lowStockCount: 0,
  totalProducts: 0,
};

export const useAppStore = create<AppState>((set, get) => ({
  isReady: false,
  isSetupComplete: false,
  isUnlocked: false,
  pinRequired: false,
  settings: null,
  stats: defaultStats,
  themeMode: 'light',
  currentStaff: null,

  init: async () => {
    await initDatabase();
    const settings = await getBusinessSettings();
    const setupComplete = await isBusinessSetupComplete();
    const pinSet = await hasPinSet();
    const pinRequired = Boolean(settings?.pinEnabled && pinSet);
    const theme = await getThemeSettings();
    const staffId = await getCurrentStaffId();
    const staff = staffId ? await getStaffById(staffId) : null;

    set({
      settings,
      isSetupComplete: setupComplete,
      pinRequired,
      isUnlocked: !pinRequired,
      isReady: true,
      themeMode: theme.mode,
      currentStaff: staff,
    });

    if (setupComplete) {
      await get().refreshStats();
    }
  },

  refreshSettings: async () => {
    const settings = await getBusinessSettings();
    const setupComplete = await isBusinessSetupComplete();
    const pinSet = await hasPinSet();
    const pinRequired = Boolean(settings?.pinEnabled && pinSet);
    set({
      settings,
      isSetupComplete: setupComplete,
      pinRequired,
      isUnlocked: pinRequired ? get().isUnlocked : true,
    });
  },

  refreshStats: async () => {
    const [sales, lowStock, totalProducts] = await Promise.all([
      getTodaySalesStats(),
      countLowStock(),
      countProducts(),
    ]);
    set({
      stats: {
        todaySales: sales.total,
        todayTransactions: sales.count,
        lowStockCount: lowStock,
        totalProducts,
      },
    });
  },

  refreshTheme: async () => {
    const theme = await getThemeSettings();
    set({ themeMode: theme.mode });
  },

  refreshStaff: async () => {
    const staffId = await getCurrentStaffId();
    const staff = staffId ? await getStaffById(staffId) : null;
    set({ currentStaff: staff });
  },

  setCurrentStaff: async (staff) => {
    await setCurrentStaffId(staff?.id ?? null);
    set({ currentStaff: staff });
  },

  updateSettings: async (input) => {
    const updated = await saveBusinessSettings(input);
    const pinSet = await hasPinSet();
    const pinRequired = Boolean(updated.pinEnabled && pinSet);
    set({
      settings: updated,
      isSetupComplete: Boolean(updated.businessName?.trim()),
      pinRequired,
      isUnlocked: pinRequired ? get().isUnlocked : true,
    });
  },

  setThemeMode: async (mode) => {
    const { saveThemeSettings } = await import('../repositories/metaRepository');
    await saveThemeSettings({ mode });
    set({ themeMode: mode });
  },

  unlock: () => set({ isUnlocked: true }),
  lock: () => {
    const { pinRequired } = get();
    if (pinRequired) set({ isUnlocked: false });
  },
}));
