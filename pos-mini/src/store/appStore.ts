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
import { getCurrentStaffId, getThemeSettings, getRequireStaffLogin, setCurrentStaffId } from '../repositories/metaRepository';
import { getStaffById, staffCount } from '../repositories/staffRepository';
import { hasPinSet } from '../utils/pin';
import { initI18n } from '../i18n';

type AppState = {
  isReady: boolean;
  isSetupComplete: boolean;
  isUnlocked: boolean;
  pinRequired: boolean;
  settings: BusinessSettings | null;
  stats: HomeStats;
  themeMode: ThemeMode;
  currentStaff: Staff | null;
  staffSignInRequired: boolean;
  init: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshTheme: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  setCurrentStaff: (staff: Staff | null) => Promise<void>;
  updateSettings: (input: Partial<BusinessSettings>) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  unlock: () => void;
  lock: () => Promise<void>;
  completeStaffSignIn: () => void;
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
  staffSignInRequired: false,

  init: async () => {
    await initDatabase();
    await initI18n();
    const settings = await getBusinessSettings();
    const setupComplete = await isBusinessSetupComplete();
    const pinSet = await hasPinSet();
    const activeStaffCount = await staffCount();
    const theme = await getThemeSettings();
    const requireStaffLogin = await getRequireStaffLogin();

    let pinRequired = Boolean(settings?.pinEnabled && pinSet);
    let staffSignInRequired = false;

    if (activeStaffCount > 0 && requireStaffLogin) {
      await setCurrentStaffId(null);
      staffSignInRequired = true;
      pinRequired = false;
    }

    set({
      settings,
      isSetupComplete: setupComplete,
      pinRequired,
      staffSignInRequired,
      isUnlocked: !pinRequired,
      isReady: true,
      themeMode: theme.mode,
      currentStaff: null,
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
  completeStaffSignIn: () => set({ staffSignInRequired: false }),
  lock: async () => {
    const activeStaffCount = await staffCount();
    const requireStaffLogin = await getRequireStaffLogin();
    await setCurrentStaffId(null);
    if (activeStaffCount > 0 && requireStaffLogin) {
      set({ currentStaff: null, staffSignInRequired: true, isUnlocked: true });
      return;
    }
    const { pinRequired } = get();
    if (pinRequired) set({ isUnlocked: false, currentStaff: null });
    else set({ currentStaff: null });
  },
}));

