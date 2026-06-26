import * as SecureStore from "expo-secure-store";

import { create } from "zustand";

import { loginWithEmail } from "../api/auth";

import { fetchModuleEntitlements } from "../api/modules";
import { fetchHotelContext } from "../api/hotel";

import { clearStoredTokens, configureApiClient, resetUnauthorizedGuard, storeTokens } from "../api/client";

import { mmkvGetString, mmkvSetString } from "../storage/mmkv";

import type { AuthUser } from "../types";

import { useCartStore } from "./cartStore";



const USER_KEY = "hms_user_json";

const SAVED_EMAIL_KEY = "saved_email";



const ALLOWED_ROLES = new Set([

  "FNB_STAFF",

  "WAITER",

  "HOTEL_ADMIN",

  "CASHIER",

  "RECEPTIONIST",

  "MANAGER",

  "SUPER_ADMIN",

]);



type AuthState = {

  token: string | null;

  refreshToken: string | null;

  user: AuthUser | null;

  enabledModules: string[];

  posRequireShift: boolean;

  posLowStockThreshold: number;

  isAuthenticated: boolean;

  isHydrated: boolean;

  login: (email: string, password: string) => Promise<void>;

  loginWithTokens: (access: string, refresh: string, user: AuthUser) => Promise<void>;

  logout: () => Promise<void>;

  setTokens: (access: string, refresh: string, user: AuthUser) => Promise<void>;

  restoreSession: () => Promise<boolean>;

  setHydrated: () => void;

  loadHotelSettings: (hotelId: string) => Promise<void>;

  hasModule: (key: string) => boolean;

  savedEmail: () => string | null;

};



async function loadModules(hotelId: string): Promise<string[]> {

  try {

    return await fetchModuleEntitlements(hotelId);

  } catch {

    return ["RESTAURANT_POS"];

  }

}



export const useAuthStore = create<AuthState>((set, get) => ({

  token: null,

  refreshToken: null,

  user: null,

  enabledModules: [],

  posRequireShift: true,

  posLowStockThreshold: 5,

  isAuthenticated: false,

  isHydrated: false,



  setHydrated: () => set({ isHydrated: true }),



  hasModule: (key) => get().enabledModules.includes(key),

  loadHotelSettings: async (hotelId) => {
    try {
      const ctx = await fetchHotelContext(hotelId);
      set({
        posRequireShift: ctx.posRequireShift !== false,
        posLowStockThreshold: ctx.posLowStockThreshold && ctx.posLowStockThreshold > 0 ? ctx.posLowStockThreshold : 5,
      });
    } catch {
      set({ posRequireShift: true, posLowStockThreshold: 5 });
    }
  },

  savedEmail: () => mmkvGetString(SAVED_EMAIL_KEY) ?? null,



  setTokens: async (access, refresh, user) => {
    resetUnauthorizedGuard();
    await storeTokens(access, refresh);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    // Set auth state before follow-up API calls (X-Hotel-ID header, gated screens).
    set({
      token: access,
      refreshToken: refresh,
      user,
      enabledModules: ["RESTAURANT_POS"],
      isAuthenticated: true,
    });

    let modules = ["RESTAURANT_POS"];
    let posRequireShift = true;
    let posLowStockThreshold = 5;
    if (user.hotelId) {
      try {
        modules = await loadModules(user.hotelId);
      } catch {
        /* keep default */
      }
      try {
        const ctx = await fetchHotelContext(user.hotelId);
        posRequireShift = ctx.posRequireShift !== false;
        posLowStockThreshold =
          ctx.posLowStockThreshold && ctx.posLowStockThreshold > 0 ? ctx.posLowStockThreshold : 5;
      } catch {
        /* keep defaults */
      }
    }

    set({ enabledModules: modules, posRequireShift, posLowStockThreshold });
  },

  restoreSession: async () => {
    const session = await hydrateAuthFromSecureStore();
    if (!session) return false;

    try {
      const axios = (await import("axios")).default;
      const { getApiBaseUrl } = await import("../api/settings");
      const { data } = await axios.post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>(
        `${getApiBaseUrl()}/api/v1/auth/refresh`,
        { refreshToken: session.refresh },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Client-Type": "mobile",
          },
        },
      );
      await get().setTokens(data.accessToken, data.refreshToken, data.user ?? session.user);
      return true;
    } catch {
      await get().logout();
      return false;
    }
  },



  loginWithTokens: async (access, refresh, user) => {

    if (user.email) mmkvSetString(SAVED_EMAIL_KEY, user.email);

    if (user.hotelId) mmkvSetString("last_hotel_id", user.hotelId);

    await get().setTokens(access, refresh, user);

  },



  login: async (email, password) => {

    const res = await loginWithEmail(email.trim(), password);

    const role = res.user.role?.toUpperCase() ?? "";

    if (!ALLOWED_ROLES.has(role)) {

      throw new Error("This app is for restaurant staff only.");

    }

    if (!res.user.hotelId) {

      throw new Error("Your account is not assigned to a hotel.");

    }

    mmkvSetString(SAVED_EMAIL_KEY, email.trim());

    mmkvSetString("last_hotel_id", res.user.hotelId);

    await get().loginWithTokens(res.accessToken, res.refreshToken, res.user);

  },



  logout: async () => {

    const hotelId = get().user?.hotelId;

    if (hotelId) {

      try {

        const { unregisterPushToken } = await import("../notifications/setup");

        await unregisterPushToken(hotelId);

      } catch {

        // ignore

      }

    }

    await clearStoredTokens();

    await SecureStore.deleteItemAsync(USER_KEY);

    useCartStore.getState().clearCart();

    const { useShiftStore } = await import("./shiftStore");

    useShiftStore.getState().clearShift();

    set({

      token: null,

      refreshToken: null,

      user: null,

      enabledModules: [],

      posRequireShift: true,

      posLowStockThreshold: 5,

      isAuthenticated: false,

    });

  },

}));



export async function hydrateAuthFromSecureStore(): Promise<{

  access: string;

  refresh: string;

  user: AuthUser;

} | null> {

  const access = await SecureStore.getItemAsync("hms_access_token");

  const refresh = await SecureStore.getItemAsync("hms_refresh_token");

  const userJson = await SecureStore.getItemAsync(USER_KEY);

  if (!access || !refresh || !userJson) return null;

  try {

    const user = JSON.parse(userJson) as AuthUser;

    if (!user.hotelId) return null;

    return { access, refresh, user };

  } catch {

    return null;

  }

}



export function initAuthApiBridge(onUnauthorized: () => void) {

  configureApiClient({

    getHotelId: () => useAuthStore.getState().user?.hotelId ?? null,

    onUnauthorized: () => {

      void useAuthStore.getState().logout();

      onUnauthorized();

    },

  });

}


