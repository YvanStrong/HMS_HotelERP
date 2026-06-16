/**

 * Fast local key-value storage for Expo Go.

 * Uses AsyncStorage with an in-memory cache (MMKV requires a dev build).

 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { StateStorage } from "zustand/middleware";



const PREFIX = "hms-kv:";

const mem = new Map<string, string>();



function storageKey(key: string): string {

  return PREFIX + key;

}



export async function initLocalStorage(): Promise<void> {

  const all = await AsyncStorage.getAllKeys();

  const ours = all.filter((k) => k.startsWith(PREFIX));

  if (ours.length === 0) return;

  const pairs = await AsyncStorage.multiGet(ours);

  for (const [k, v] of pairs) {

    if (v) mem.set(k.slice(PREFIX.length), v);

  }

}



export const mmkvStorage: StateStorage = {

  getItem: async (name) => {

    if (mem.has(name)) return mem.get(name) ?? null;

    const v = await AsyncStorage.getItem(storageKey(name));

    if (v) mem.set(name, v);

    return v;

  },

  setItem: async (name, value) => {

    mem.set(name, value);

    await AsyncStorage.setItem(storageKey(name), value);

  },

  removeItem: async (name) => {

    mem.delete(name);

    await AsyncStorage.removeItem(storageKey(name));

  },

};



export function mmkvGetString(key: string): string | null {

  return mem.get(key) ?? null;

}



export function mmkvSetString(key: string, value: string): void {

  mem.set(key, value);

  void AsyncStorage.setItem(storageKey(key), value);

}



export function mmkvDelete(key: string): void {

  mem.delete(key);

  void AsyncStorage.removeItem(storageKey(key));

}



const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;



/** Drop offline queue actions older than 7 days (called on app start). */

export function purgeStaleLocalData(): void {

  try {

    const raw = mem.get("hms-offline-queue");

    if (!raw) return;

    const parsed = JSON.parse(raw) as {

      state?: { queue?: Array<{ createdAt: string }> };

    };

    const queue = parsed?.state?.queue;

    if (!Array.isArray(queue)) return;

    const cutoff = Date.now() - SEVEN_DAYS_MS;

    const fresh = queue.filter((a) => {

      const t = Date.parse(a.createdAt);

      return Number.isFinite(t) && t >= cutoff;

    });

    if (fresh.length === queue.length) return;

    parsed.state = { ...parsed.state, queue: fresh };

    const next = JSON.stringify(parsed);

    mem.set("hms-offline-queue", next);

    void AsyncStorage.setItem(storageKey("hms-offline-queue"), next);

  } catch {

    // ignore corrupt cache

  }

}


