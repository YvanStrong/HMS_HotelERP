import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

import { mmkvStorage } from "../storage/mmkv";



export type OfflineActionType = "OPEN_TICKET" | "ADD_LINES" | "SEND_TO_KITCHEN" | "CLOSE_TICKET";



export type OfflineAction = {

  id: string;

  type: OfflineActionType;

  payload: Record<string, unknown>;

  ticketId: string | null;

  hotelId: string;

  createdAt: string;

  retryCount: number;

  lastError: string | null;

};



type OfflineQueueState = {

  queue: OfflineAction[];

  isSyncing: boolean;

  isOnline: boolean;

  syncCompleteFlash: boolean;

  ticketIdMap: Record<string, string>;

  enqueue: (action: Omit<OfflineAction, "retryCount" | "lastError">) => void;

  dequeue: (actionId: string) => void;

  markFailed: (actionId: string, error: string) => void;

  setSyncing: (v: boolean) => void;

  setOnline: (v: boolean) => void;

  setSyncCompleteFlash: (v: boolean) => void;

  mapTicketId: (localId: string, serverId: string) => void;

  resolveTicketId: (id: string | null) => string | null;

  clearQueue: () => void;

  pendingCount: () => number;

  getFailedActions: () => OfflineAction[];

  retryFailed: () => void;

};



export const useOfflineQueueStore = create<OfflineQueueState>()(

  persist(

    (set, get) => ({

      queue: [],

      isSyncing: false,

      isOnline: true,

      syncCompleteFlash: false,

      ticketIdMap: {},



      enqueue: (action) =>

        set((s) => ({

          queue: [

            ...s.queue,

            { ...action, retryCount: 0, lastError: null },

          ],

        })),



      dequeue: (actionId) =>

        set((s) => ({ queue: s.queue.filter((a) => a.id !== actionId) })),



      markFailed: (actionId, error) =>

        set((s) => ({

          queue: s.queue.map((a) =>

            a.id === actionId ? { ...a, retryCount: a.retryCount + 1, lastError: error } : a,

          ),

        })),



      setSyncing: (v) => set({ isSyncing: v }),

      setOnline: (v) => set({ isOnline: v }),

      setSyncCompleteFlash: (v) => set({ syncCompleteFlash: v }),



      mapTicketId: (localId, serverId) =>

        set((s) => ({ ticketIdMap: { ...s.ticketIdMap, [localId]: serverId } })),



      resolveTicketId: (id) => {

        if (!id) return null;

        const mapped = get().ticketIdMap[id];

        return mapped ?? id;

      },



      clearQueue: () => set({ queue: [], ticketIdMap: {} }),



      pendingCount: () => get().queue.length,

      getFailedActions: () => get().queue.filter((a) => a.retryCount >= 3),

      retryFailed: () => {
        set((s) => ({
          queue: s.queue.map((a) => (a.retryCount >= 3 ? { ...a, retryCount: 0, lastError: null } : a)),
        }));
        void import("../hooks/offlineSync").then((m) => m.syncOfflineQueue().catch(() => {}));
      },

    }),

    {

      name: "hms-offline-queue",

      storage: createJSONStorage(() => mmkvStorage),

      partialize: (s) => ({

        queue: s.queue,

        ticketIdMap: s.ticketIdMap,

      }),

    },

  ),

);


