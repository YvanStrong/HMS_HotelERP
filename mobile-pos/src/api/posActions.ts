import Toast from "react-native-toast-message";

import type { CartLine } from "../types";

import { isNetworkError } from "./network";

import {

  addTicketLines,

  closeTicket,

  openTicket,

  sendTicketToKitchen,

  type TicketDetail,

} from "./tickets";

import { useOfflineQueueStore } from "../store/offlineQueueStore";

import { useCartStore } from "../store/cartStore";

import { getPrinter } from "../printing/PrinterConfig";

import {
  fireAndForgetPrint,
  isBarItem,
  printKitchenTicket,
} from "../printing/PrinterService";



function newLocalId(): string {

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



function enqueueOffline(

  type: "OPEN_TICKET" | "ADD_LINES" | "SEND_TO_KITCHEN" | "CLOSE_TICKET",

  hotelId: string,

  ticketId: string | null,

  payload: Record<string, unknown>,

) {

  useOfflineQueueStore.getState().enqueue({

    id: newLocalId(),

    type,

    payload,

    ticketId,

    hotelId,

    createdAt: new Date().toISOString(),

  });

  Toast.show({

    type: "info",

    text1: "Saved offline",

    text2: "Will sync when connected",

  });

}



export async function openTicketAction(

  hotelId: string,

  payload: {

    depotId: string;

    tableLabel: string;

    tableId?: string;

    customerName?: string;

    guestCount?: number;

    reservationId?: string;

    lines?: CartLine[];

  },

): Promise<TicketDetail> {

  try {

    const detail = await openTicket(hotelId, payload);

    useCartStore.getState().setActiveTicket(detail.id, detail.status, detail.currentRound);

    return detail;

  } catch (err) {

    if (!isNetworkError(err)) throw err;

    const localId = newLocalId();

    enqueueOffline("OPEN_TICKET", hotelId, localId, payload as Record<string, unknown>);

    useCartStore.getState().setActiveTicket(localId, "OPEN", 1);

    return {

      id: localId,

      depotId: payload.depotId,

      depotName: useCartStore.getState().selectedDepot?.name ?? "",

      tableLabel: payload.tableLabel,

      tableId: payload.tableId,

      status: "OPEN",

      subtotal: 0,

      taxAmount: 0,

      totalAmount: 0,

      currentRound: 1,

      lines: [],

    };

  }

}



export async function addLinesAction(

  hotelId: string,

  ticketId: string,

  lines: CartLine[],

): Promise<TicketDetail | null> {

  const resolved = useOfflineQueueStore.getState().resolveTicketId(ticketId) ?? ticketId;

  if (resolved.startsWith("local-")) {

    enqueueOffline("ADD_LINES", hotelId, resolved, { lines });

    useCartStore.getState().clearPendingLines();

    return null;

  }

  try {

    return await addTicketLines(hotelId, resolved, lines);

  } catch (err) {

    if (!isNetworkError(err)) throw err;

    enqueueOffline("ADD_LINES", hotelId, resolved, { lines });

    useCartStore.getState().clearPendingLines();

    return null;

  }

}



export async function sendKitchenAction(
  hotelId: string,
  ticketId: string,
  options?: { fireHeld?: boolean },
): Promise<TicketDetail | null> {

  const resolved = useOfflineQueueStore.getState().resolveTicketId(ticketId) ?? ticketId;

  if (resolved.startsWith("local-")) {

    enqueueOffline("SEND_TO_KITCHEN", hotelId, resolved, {});

    return null;

  }

  try {

    const detail = await sendTicketToKitchen(hotelId, resolved, options);

    void autoPrintKitchenTickets(detail);

    return detail;

  } catch (err) {

    if (!isNetworkError(err)) throw err;

    enqueueOffline("SEND_TO_KITCHEN", hotelId, resolved, {});

    return null;

  }

}



function autoPrintKitchenTickets(detail: TicketDetail): void {

  const pendingLines = detail.lines.filter((l) => l.lineStatus === "PENDING" || !l.sentAt);

  const roundLines = pendingLines.length > 0 ? pendingLines : detail.lines;

  if (getPrinter("kitchen")) {

    void fireAndForgetPrint("kitchen", () =>

      printKitchenTicket(detail.tableLabel, detail.currentRound, roundLines, "kitchen"),

    );

  }

  if (getPrinter("bar")) {

    const barLines = roundLines.filter((l) => isBarItem(l));

    if (barLines.length > 0) {

      void fireAndForgetPrint("bar", () =>

        printKitchenTicket(detail.tableLabel, detail.currentRound, barLines, "bar"),

      );

    }

  }

}



export async function closeTicketAction(

  hotelId: string,

  ticketId: string,

  body: {

    mode: string;

    paymentMethod?: string;

    chargeToRoom?: boolean;

    reservationId?: string;

    customerName?: string;

    tipAmount?: number;

  },

): Promise<TicketDetail | null> {

  const resolved = useOfflineQueueStore.getState().resolveTicketId(ticketId) ?? ticketId;

  if (resolved.startsWith("local-")) {

    enqueueOffline("CLOSE_TICKET", hotelId, resolved, body);

    return null;

  }

  try {

    return await closeTicket(hotelId, resolved, body);

  } catch (err) {

    if (!isNetworkError(err)) throw err;

    enqueueOffline("CLOSE_TICKET", hotelId, resolved, body);

    return null;

  }

}


