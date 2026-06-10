import {

  addTicketLines,

  closeTicket,

  openTicket,

  sendTicketToKitchen,

} from "../api/tickets";

import type { CartLine } from "../types";

import type { OfflineAction } from "../store/offlineQueueStore";

import { useOfflineQueueStore } from "../store/offlineQueueStore";

import { useCartStore } from "../store/cartStore";

import Toast from "react-native-toast-message";



let syncing = false;



async function executeAction(

  action: OfflineAction,

  ticketIdMap: Record<string, string>,

): Promise<{ serverTicketId?: string }> {

  const hotelId = action.hotelId;

  let ticketId = action.ticketId;

  if (ticketId && ticketIdMap[ticketId]) {

    ticketId = ticketIdMap[ticketId];

  }



  switch (action.type) {

    case "OPEN_TICKET": {

      const p = action.payload as {

        depotId: string;

        tableLabel: string;

        tableId?: string;

        customerName?: string;

        guestCount?: number;

        lines?: CartLine[];

      };

      const detail = await openTicket(hotelId, p);

      if (action.ticketId?.startsWith("local-")) {

        return { serverTicketId: detail.id };

      }

      return {};

    }

    case "ADD_LINES": {

      if (!ticketId) throw new Error("Missing ticketId");

      const lines = (action.payload.lines as CartLine[]) ?? [];

      await addTicketLines(hotelId, ticketId, lines);

      return {};

    }

    case "SEND_TO_KITCHEN": {

      if (!ticketId) throw new Error("Missing ticketId");

      await sendTicketToKitchen(hotelId, ticketId);

      return {};

    }

    case "CLOSE_TICKET": {

      if (!ticketId) throw new Error("Missing ticketId");

      await closeTicket(hotelId, ticketId, action.payload as Parameters<typeof closeTicket>[2]);

      return {};

    }

    default:

      return {};

  }

}



export async function syncOfflineQueue(): Promise<void> {

  if (syncing) return;

  const store = useOfflineQueueStore.getState();

  if (store.queue.length === 0) return;



  syncing = true;

  store.setSyncing(true);

  const ticketIdMap = { ...store.ticketIdMap };

  let synced = 0;

  const queue = [...store.queue];



  try {

    for (const action of queue) {

      if (action.retryCount >= 3) continue;

      try {

        const result = await executeAction(action, ticketIdMap);

        if (result.serverTicketId && action.ticketId?.startsWith("local-")) {

          ticketIdMap[action.ticketId] = result.serverTicketId;

          store.mapTicketId(action.ticketId, result.serverTicketId);

          const active = useCartStore.getState().ticketId;

          if (active === action.ticketId) {

            useCartStore.getState().setActiveTicket(result.serverTicketId, "OPEN");

          }

        }

        store.dequeue(action.id);

        synced++;

      } catch (err) {

        const msg = err instanceof Error ? err.message : "Sync failed";

        store.markFailed(action.id, msg);

        const updated = useOfflineQueueStore.getState().queue.find((a) => a.id === action.id);

        if (updated && updated.retryCount >= 3) {

          Toast.show({

            type: "error",

            text1: "Order failed to sync",

            text2: "Please check with manager",

          });

        }

      }

    }



    if (synced > 0) {

      store.setSyncCompleteFlash(true);

      Toast.show({

        type: "success",

        text1: "Orders synced",

        text2: `${synced} offline action${synced === 1 ? "" : "s"} synced`,

      });

      setTimeout(() => useOfflineQueueStore.getState().setSyncCompleteFlash(false), 2500);

    }

  } finally {

    store.setSyncing(false);

    syncing = false;

  }

}


