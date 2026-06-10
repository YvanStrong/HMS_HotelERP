import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocalSearchParams, useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePosWebSocket } from "../../../src/hooks/usePosWebSocket";

import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import Toast from "react-native-toast-message";

import { apiErrorMessage } from "../../../src/api/client";

import { addLinesAction, sendKitchenAction } from "../../../src/api/posActions";

import { fetchTicket, money, type TicketLine } from "../../../src/api/tickets";

import { CartLineItem } from "../../../src/components/CartLineItem";

import { PaymentModal } from "../../../src/components/PaymentModal";
import { PrinterModal } from "../../../src/components/PrinterModal";
import type { TicketDetail } from "../../../src/api/tickets";
import { getPrinter } from "../../../src/printing/PrinterConfig";

import { resolveTicketId } from "../../../src/lib/ticketId";

import { useAuthStore } from "../../../src/store/authStore";

import { useCartStore } from "../../../src/store/cartStore";



function lineStatusStyle(status: string) {

  switch (status) {

    case "PREPARING":

      return "text-amber-700";

    case "READY":

      return "text-emerald-700";

    case "SERVED":

      return "text-slate-400";

    default:

      return "text-slate-600";

  }

}



function TicketLineRow({ line }: { line: TicketLine }) {

  return (

    <View className="mb-2 rounded-xl border border-slate-200 bg-white p-3">

      <View className="flex-row justify-between">

        <Text className="flex-1 font-medium text-slate-900">

          {line.quantity}× {line.productName}

        </Text>

        <Text className="font-semibold text-slate-800">{money(line.lineTotal).toFixed(2)}</Text>

      </View>

      <View className="mt-1 flex-row justify-between">

        <Text className="text-xs text-slate-500">Round {line.round}</Text>

        <Text className={`text-xs font-medium ${lineStatusStyle(line.lineStatus)}`}>{line.lineStatus}</Text>

      </View>

      {line.notes ? <Text className="mt-1 text-xs text-slate-500">{line.notes}</Text> : null}

    </View>

  );

}



export default function TicketScreen() {

  const { ticketId: routeTicketId } = useLocalSearchParams<{ ticketId: string }>();

  const router = useRouter();

  const queryClient = useQueryClient();

  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const userRole = useAuthStore((s) => s.user?.role) ?? "";

  const depot = useCartStore((s) => s.selectedDepot);

  const storeTicketId = useCartStore((s) => s.ticketId);

  const pendingLines = useCartStore((s) => s.lines);

  const pendingSubtotal = useCartStore((s) => s.subtotal());

  const pendingTax = useCartStore((s) => s.tax());

  const pendingTotal = useCartStore((s) => s.total());

  const updateQty = useCartStore((s) => s.updateQty);

  const removeItem = useCartStore((s) => s.removeItem);

  const setActiveTicket = useCartStore((s) => s.setActiveTicket);

  const clearPendingLines = useCartStore((s) => s.clearPendingLines);

  const clearCart = useCartStore((s) => s.clearCart);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [closedForPrint, setClosedForPrint] = useState<TicketDetail | null>(null);



  const ticketId = resolveTicketId(routeTicketId, storeTicketId);



  // Safety: if URL segment is "index" but we have a real ticket, replace route.

  useEffect(() => {

    const raw = Array.isArray(routeTicketId) ? routeTicketId[0] : routeTicketId;

    if ((raw === "index" || raw === "current") && ticketId) {

      router.replace(`/(main)/ticket/${ticketId}`);

    }

  }, [routeTicketId, ticketId, router]);



  const refreshTicket = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["pos-ticket", hotelId, ticketId] });
  }, [queryClient, hotelId, ticketId]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["pos-ticket", hotelId, ticketId],
    queryFn: () => fetchTicket(hotelId, ticketId!),
    enabled: !!hotelId && !!ticketId,
    refetchInterval: 12000,
  });

  usePosWebSocket(
    hotelId,
    hotelId ? [`/topic/hotel/${hotelId}/pos/line-ready`] : [],
    refreshTicket,
    !!hotelId && !!ticketId,
  );



  const rounds = useMemo(() => {

    if (!ticket) return [];

    const map = new Map<number, TicketLine[]>();

    for (const line of ticket.lines) {

      const bucket = map.get(line.round) ?? [];

      bucket.push(line);

      map.set(line.round, bucket);

    }

    return [...map.entries()].sort((a, b) => a[0] - b[0]);

  }, [ticket]);



  const subtotal = money(ticket?.subtotal) + pendingSubtotal;

  const tax = money(ticket?.taxAmount) + pendingTax;

  const total = money(ticket?.totalAmount) + pendingTotal;



  const addRoundMut = useMutation({

    mutationFn: async () => {

      if (!ticketId || pendingLines.length === 0) return null;

      return addLinesAction(hotelId, ticketId, pendingLines);

    },

    onSuccess: (detail) => {

      clearPendingLines();

      if (detail) {

        setActiveTicket(detail.id, detail.status, detail.currentRound);

        void queryClient.invalidateQueries({ queryKey: ["pos-ticket", hotelId, ticketId] });

        Toast.show({ type: "success", text1: "Round added to ticket" });

      }

    },

    onError: (err) => Toast.show({ type: "error", text1: "Could not add items", text2: apiErrorMessage(err) }),

  });



  const kitchenMut = useMutation({

    mutationFn: async () => {

      if (!ticketId) throw new Error("No ticket");

      if (pendingLines.length > 0) {

        await addLinesAction(hotelId, ticketId, pendingLines);

        clearPendingLines();

      }

      return sendKitchenAction(hotelId, ticketId);

    },

    onSuccess: (detail) => {

      if (detail) {

        setActiveTicket(detail.id, detail.status, detail.currentRound);

        void queryClient.invalidateQueries({ queryKey: ["pos-ticket", hotelId, ticketId] });

        void queryClient.invalidateQueries({ queryKey: ["kitchen-board", hotelId, depot?.id] });

        Toast.show({ type: "success", text1: "Sent to kitchen" });

      }

    },

    onError: (err) => Toast.show({ type: "error", text1: "Kitchen send failed", text2: apiErrorMessage(err) }),

  });



  if (!depot) {

    return (

      <View className="flex-1 items-center justify-center bg-slate-50 px-6">

        <Text className="text-slate-600">No active order context.</Text>

      </View>

    );

  }



  if (!ticketId) {

    return (

      <View className="flex-1 items-center justify-center bg-slate-50 px-6">

        <Text className="mb-4 text-center text-slate-600">Open a table ticket from Tables.</Text>

        <Pressable onPress={() => router.push("/(main)/tables")} className="rounded-xl bg-indigo-600 px-4 py-3">

          <Text className="font-semibold text-white">Go to tables</Text>

        </Pressable>

      </View>

    );

  }



  if (isLoading && !ticket) {

    return (

      <View className="flex-1 items-center justify-center bg-slate-50">

        <ActivityIndicator color="#4f46e5" />

      </View>

    );

  }



  const closed = ticket?.status === "CLOSED" || ticket?.status === "CANCELLED";
  const activeLines = ticket?.lines.filter((l) => l.lineStatus !== "CANCELLED") ?? [];
  const allServed =
    activeLines.length > 0 && activeLines.every((l) => l.lineStatus === "SERVED");
  const hasPendingKitchen = activeLines.some((l) => l.lineStatus === "PENDING");
  const isManagerRole = ["HOTEL_ADMIN", "MANAGER", "CASHIER", "SUPER_ADMIN"].includes(userRole);
  const canPay =
    isManagerRole ||
    ticket?.status === "SERVED" ||
    (userRole === "WAITER" && allServed);
  const payLabel =
    userRole === "WAITER" && !isManagerRole
      ? allServed
        ? "Request bill"
        : "Pay / close ticket"
      : allServed
        ? "Proceed to payment"
        : "Pay / close ticket";

  return (

    <View className="flex-1 bg-slate-50">

      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-12">

        <Text className="text-xl font-bold text-slate-900">{ticket?.tableLabel ?? "Ticket"}</Text>

        <Text className="text-sm text-slate-500">

          {depot.name} · {ticket?.status ?? "…"}

          {ticket?.waiterName ? ` · ${ticket.waiterName}` : ""}

        </Text>

      </View>



      <ScrollView className="flex-1 px-4 py-4">

        {rounds.map(([round, lines]) => (

          <View key={round} className="mb-4">

            <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Round {round}</Text>

            {lines.map((line) => (

              <TicketLineRow key={line.id} line={line} />

            ))}

          </View>

        ))}



        {pendingLines.length > 0 ? (

          <View className="mb-4">

            <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">Pending round</Text>

            {pendingLines.map((line) => (

              <CartLineItem

                key={line.productId}

                line={line}

                onDecrease={() => updateQty(line.productId, line.qty - 1)}

                onIncrease={() => updateQty(line.productId, line.qty + 1)}

                onRemove={() => removeItem(line.productId)}

              />

            ))}

            <Pressable

              disabled={addRoundMut.isPending || closed}

              onPress={() => addRoundMut.mutate()}

              className="mt-2 rounded-xl bg-indigo-600 py-3"

            >

              <Text className="text-center font-semibold text-white">

                {addRoundMut.isPending ? "Adding…" : "Add round to ticket"}

              </Text>

            </Pressable>

          </View>

        ) : null}



        {!ticket?.lines.length && !pendingLines.length ? (

          <Text className="text-center text-slate-500">No items yet. Add from the menu.</Text>

        ) : null}

      </ScrollView>



      <View className="border-t border-slate-200 bg-white px-4 py-4">

        <View className="mb-3 rounded-xl bg-slate-50 p-3">

          {pendingLines.length > 0 ? (

            <Text className="mb-2 text-[11px] text-indigo-600">Includes pending round not yet on ticket</Text>

          ) : null}

          <View className="flex-row justify-between">

            <Text className="text-slate-600">Subtotal</Text>

            <Text className="font-medium">{subtotal.toFixed(2)}</Text>

          </View>

          <View className="mt-1 flex-row justify-between">

            <Text className="text-slate-600">Tax</Text>

            <Text className="font-medium">{tax.toFixed(2)}</Text>

          </View>

          <View className="mt-2 flex-row justify-between border-t border-slate-200 pt-2">

            <Text className="font-bold text-slate-900">Total</Text>

            <Text className="text-lg font-bold text-indigo-600">{total.toFixed(2)}</Text>

          </View>

        </View>



        {!closed ? (

          <>

            {canPay ? (
            <Pressable

              disabled={!ticket?.lines.length && pendingLines.length === 0}

              onPress={() => setPaymentOpen(true)}

              className={`mb-3 rounded-xl py-4 ${

                ticket?.lines.length || pendingLines.length ? "bg-indigo-600" : "bg-slate-300"

              }`}

            >

              <Text className="text-center font-semibold text-white">
                {payLabel}
              </Text>

            </Pressable>
            ) : null}



            <Pressable

              disabled={kitchenMut.isPending || (!ticket?.lines.length && !pendingLines.length)}

              onPress={() => kitchenMut.mutate()}

              className="mb-3 rounded-xl border border-slate-300 py-3"

            >

              <Text className="text-center font-medium text-slate-700">

                {kitchenMut.isPending
                  ? "Sending…"
                  : hasPendingKitchen
                    ? "Send to kitchen"
                    : "Kitchen updated"}

              </Text>

            </Pressable>

          </>

        ) : null}



        <Pressable

          onPress={() => {

            if (depot) router.push(`/(main)/menu/${depot.id}`);

          }}

          className="rounded-xl py-3"

        >

          <Text className="text-center font-medium text-indigo-600">Add more items</Text>

        </Pressable>

      </View>



      <PaymentModal

        visible={paymentOpen}

        ticketId={ticketId}

        ticket={ticket ?? null}

        onClose={() => setPaymentOpen(false)}

        onSuccess={(message, closed) => {

          Toast.show({ type: "success", text1: "Done", text2: message });

          if (closed) {

            if (getPrinter("receipt")) {

              setClosedForPrint(closed);

              setPrinterOpen(true);

            } else {

              clearCart();

              router.replace("/(main)/tables");

            }

          } else {

            clearCart();

            router.replace("/(main)/tables");

          }

        }}

      />

      <PrinterModal

        visible={printerOpen}

        ticket={closedForPrint}

        hotelName={depot?.name ?? "Hotel"}

        onClose={() => {

          setPrinterOpen(false);

          clearCart();

          router.replace("/(main)/tables");

        }}

        onSkip={() => {

          setPrinterOpen(false);

          clearCart();

          router.replace("/(main)/tables");

        }}

      />

    </View>

  );

}

