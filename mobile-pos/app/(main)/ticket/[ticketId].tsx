import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocalSearchParams, useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePosWebSocket } from "../../../src/hooks/usePosWebSocket";

import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import { apiErrorMessage } from "../../../src/api/client";

import { addLinesAction, sendKitchenAction } from "../../../src/api/posActions";
import { fireHeldItems } from "../../../src/api/tickets";
import { useTranslation } from "react-i18next";
import { HOLD_COURSES, type HoldCourse } from "../../../src/lib/allergens";
import { hapticSuccess } from "../../../src/lib/haptics";

import { fetchTicket, fetchOpenTickets, fetchPosTables, mergeTickets, money, removePendingLine, transferTicket, type TicketLine } from "../../../src/api/tickets";

import { CartLineItem } from "../../../src/components/CartLineItem";

import { PaymentModal } from "../../../src/components/PaymentModal";
import { PrinterModal } from "../../../src/components/PrinterModal";
import { VoidDiscountModal } from "../../../src/components/VoidDiscountModal";
import { CancelTicketModal, useCancelTicketMutation } from "../../../src/components/CancelTicketModal";
import { MergeTicketModal } from "../../../src/components/MergeTicketModal";
import { ReservationBanner } from "../../../src/components/ReservationBanner";
import { TablePickerModal } from "../../../src/components/TablePickerModal";
import { useHeaderPadding } from "../../../src/hooks/useScreenInsets";
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



function TicketLineRow({
  line,
  editable,
  onModify,
  onRemovePending,
}: {
  line: TicketLine;
  editable: boolean;
  onModify?: () => void;
  onRemovePending?: () => void;
}) {
  const voided = line.voided === true;
  const isHeld = line.held === true;
  const qty = money(line.quantity);
  const unit = money(line.unitPrice);
  const gross = unit * qty;
  const lineTotal = money(line.lineTotal);
  const hasDiscount = money(line.discountAmount) > 0;
  const canRemovePending = editable && line.lineStatus === "PENDING" && !voided;
  const canModify =
    editable && !voided && line.lineStatus !== "PENDING" && line.lineStatus !== "CANCELLED";

  return (
    <View
      className={`mb-2 rounded-xl border p-3 ${
        voided
          ? "border-red-200 bg-red-50"
          : isHeld
            ? "border-slate-300 bg-slate-100"
            : "border-slate-200 bg-white"
      }`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text
          className={`flex-1 font-medium ${voided ? "text-slate-400 line-through" : "text-slate-900"}`}
        >
          {qty}× {line.productName}
        </Text>
        <View className="items-end">
          {hasDiscount && !voided ? (
            <>
              <Text className="text-xs text-slate-400 line-through">{gross.toFixed(2)}</Text>
              <Text className="font-semibold text-slate-800">{lineTotal.toFixed(2)}</Text>
            </>
          ) : (
            <Text className={`font-semibold ${voided ? "text-slate-400" : "text-slate-800"}`}>
              {voided ? "0.00" : lineTotal.toFixed(2)}
            </Text>
          )}
        </View>
      </View>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs text-slate-500">Round {line.round}</Text>
        <View className="flex-row items-center gap-2">
          {voided ? (
            <Text allowFontScaling={false} className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              VOIDED
            </Text>
          ) : isHeld ? (
            <Text allowFontScaling={false} className="rounded-full bg-slate-500 px-2 py-0.5 text-[10px] font-bold text-white">
              HELD{line.holdCourse ? ` · ${line.holdCourse}` : ""}
            </Text>
          ) : hasDiscount ? (
            <Text className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {line.discountPct != null ? `-${money(line.discountPct)}%` : `-RWF ${money(line.discountAmount).toFixed(0)}`}
            </Text>
          ) : null}
          <Text className={`text-xs font-medium ${lineStatusStyle(line.lineStatus)}`}>{line.lineStatus}</Text>
        </View>
      </View>
      {voided && line.voidReason ? (
        <Text className="mt-1 text-xs text-slate-500">{line.voidReason}</Text>
      ) : null}
      {line.notes ? <Text className="mt-1 text-xs text-slate-500">{line.notes}</Text> : null}
      {canRemovePending ? (
        <Pressable onPress={onRemovePending} className="mt-2 self-start rounded-lg bg-slate-100 px-3 py-1.5">
          <Text className="text-xs font-semibold text-red-600">Remove</Text>
        </Pressable>
      ) : null}
      {canModify ? (
        <Pressable onPress={onModify} className="mt-2 self-start rounded-lg bg-slate-100 px-3 py-1.5">
          <Text className="text-xs font-semibold text-indigo-600">Modify (void / discount)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}



export default function TicketScreen() {
  const { t } = useTranslation();
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
  const setTable = useCartStore((s) => s.setTable);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [closedForPrint, setClosedForPrint] = useState<TicketDetail | null>(null);
  const [modifyLine, setModifyLine] = useState<TicketLine | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const headerPad = useHeaderPadding();



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

  const { data: posTables = [] } = useQuery({
    queryKey: ["pos-tables", hotelId, depot?.id],
    queryFn: () => fetchPosTables(hotelId, depot!.id),
    enabled: !!hotelId && !!depot?.id && transferOpen,
  });

  const { data: openTickets = [], isLoading: openTicketsLoading } = useQuery({
    queryKey: ["open-tickets-merge", hotelId, depot?.id],
    queryFn: () => fetchOpenTickets(hotelId, depot!.id),
    enabled: !!hotelId && !!depot?.id && mergeOpen,
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
      if (line.held) continue;
      const bucket = map.get(line.round) ?? [];

      bucket.push(line);

      map.set(line.round, bucket);

    }

    return [...map.entries()].sort((a, b) => a[0] - b[0]);

  }, [ticket]);



  const subtotal = money(ticket?.subtotal) + pendingSubtotal;

  const tax = money(ticket?.taxAmount) + pendingTax;

  const total = money(ticket?.totalAmount) + pendingTotal;

  const discountTotal = money(ticket?.discountTotal);

  const removeLineMut = useMutation({
    mutationFn: (lineId: string) => removePendingLine(hotelId, ticketId!, lineId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pos-ticket", hotelId, ticketId] });
      Toast.show({ type: "success", text1: "Item removed" });
    },
    onError: (err) => Toast.show({ type: "error", text1: "Could not remove", text2: apiErrorMessage(err) }),
  });



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
    mutationFn: async (fireHeld?: boolean) => {
      if (!ticketId) throw new Error("No ticket");
      if (pendingLines.length > 0) {
        await addLinesAction(hotelId, ticketId, pendingLines);
        clearPendingLines();
      }
      return sendKitchenAction(hotelId, ticketId, fireHeld ? { fireHeld: true } : undefined);
    },
    onSuccess: async (detail) => {
      if (detail) {
        setActiveTicket(detail.id, detail.status, detail.currentRound);
        void queryClient.invalidateQueries({ queryKey: ["pos-ticket", hotelId, ticketId] });
        void queryClient.invalidateQueries({ queryKey: ["kitchen-board", hotelId, depot?.id] });
        await hapticSuccess();
        Toast.show({ type: "success", text1: t("sendToKitchen") });
      }
    },
    onError: (err) => Toast.show({ type: "error", text1: "Kitchen send failed", text2: apiErrorMessage(err) }),
  });

  const fireMut = useMutation({
    mutationFn: (course?: HoldCourse) => fireHeldItems(hotelId, ticketId!, course),
    onSuccess: (detail) => {
      setActiveTicket(detail.id, detail.status, detail.currentRound);
      void queryClient.invalidateQueries({ queryKey: ["pos-ticket", hotelId, ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["kitchen-board", hotelId, depot?.id] });
      void hapticSuccess();
      Toast.show({ type: "success", text1: "Fired held items" });
    },
    onError: (err) => Toast.show({ type: "error", text1: "Fire failed", text2: apiErrorMessage(err) }),
  });

  const cancelMut = useCancelTicketMutation(hotelId, ticketId ?? "", ticket?.tableLabel ?? "Table", () => {
    setCancelOpen(false);
    clearCart();
    router.replace("/(main)/tables");
  });

  const transferMut = useMutation({
    mutationFn: (newTableId: string) => transferTicket(hotelId, ticketId!, newTableId),
    onSuccess: (updated) => {
      setTransferOpen(false);
      setTable(updated.tableLabel ?? "", updated.tableId ?? undefined);
      void queryClient.setQueryData(["pos-ticket", hotelId, ticketId], updated);
      void queryClient.invalidateQueries({ queryKey: ["pos-tables", hotelId, depot?.id] });
      Toast.show({ type: "success", text1: `Moved to ${updated.tableLabel}` });
    },
    onError: (err) => Toast.show({ type: "error", text1: "Transfer failed", text2: apiErrorMessage(err) }),
  });

  const mergeMut = useMutation({
    mutationFn: (sourceTicketId: string) => mergeTickets(hotelId, ticketId!, sourceTicketId),
    onSuccess: (updated) => {
      setMergeOpen(false);
      void queryClient.setQueryData(["pos-ticket", hotelId, ticketId], updated);
      void queryClient.invalidateQueries({ queryKey: ["pos-tables", hotelId, depot?.id] });
      Toast.show({ type: "success", text1: `Table merged in` });
    },
    onError: (err) => Toast.show({ type: "error", text1: "Merge failed", text2: apiErrorMessage(err) }),
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
  const isOpenTicket = ticket?.status === "OPEN";
  const isLocalTicket = !!ticketId?.startsWith("local-");
  const canCancelOpen = isOpenTicket || isLocalTicket;
  const canTransfer =
    !closed && (ticket?.status === "OPEN" || ticket?.status === "SENT_TO_KITCHEN") && !isLocalTicket;
  const canMerge = canTransfer;
  const activeLines =
    ticket?.lines.filter((l) => !l.voided && l.lineStatus !== "CANCELLED") ?? [];
  const allServed =
    activeLines.length > 0 && activeLines.every((l) => l.lineStatus === "SERVED");
  const hasPendingKitchen = activeLines.some((l) => l.lineStatus === "PENDING");
  const heldLines = activeLines.filter((l) => l.held);
  const heldCourses = [...new Set(heldLines.map((l) => l.holdCourse).filter(Boolean))] as HoldCourse[];

  function handleSendKitchen() {
    const heldPending = activeLines.filter((l) => l.held && l.lineStatus === "PENDING");
    const readyPending = activeLines.filter((l) => !l.held && l.lineStatus === "PENDING");
    const pendingInCart = pendingLines.some((l) => l.isHeld);
    const hasHeld = heldPending.length > 0 || pendingInCart;
    const hasReady = readyPending.length > 0 || pendingLines.some((l) => !l.isHeld);

    if (hasHeld && hasReady) {
      Alert.alert(t("sendToKitchen"), undefined, [
        { text: "Cancel", style: "cancel" },
        { text: t("sendReadyItems"), onPress: () => kitchenMut.mutate(false) },
        { text: t("sendAllFireHeld"), onPress: () => kitchenMut.mutate(true) },
      ]);
      return;
    }
    kitchenMut.mutate(hasHeld && !hasReady);
  }

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

  function handleCancelLocal() {
    setCancelOpen(false);
    clearCart();
    Toast.show({
      type: "success",
      text1: "Ticket cancelled",
      text2: `Table ${ticket?.tableLabel ?? "table"} is free`,
    });
    router.replace("/(main)/tables");
  }

  return (

    <View className="flex-1 bg-slate-50">

      <View className="border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>

        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-900">{ticket?.tableLabel ?? "Ticket"}</Text>

            <Text className="text-sm text-slate-500">

              {depot.name} · {ticket?.status ?? "…"}

              {ticket?.waiterName ? ` · ${ticket.waiterName}` : ""}

            </Text>
          </View>

          {!closed ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              className="rounded-full bg-slate-100 p-2"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#64748b" />
            </Pressable>
          ) : null}
        </View>

      </View>

      {ticket ? <ReservationBanner ticket={ticket} /> : null}

      <ScrollView className="flex-1 px-4 py-4">
        {heldLines.length > 0 ? (
          <View className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-100 p-3">
            <Text allowFontScaling={false} className="mb-2 text-xs font-bold uppercase text-slate-600">
              {t("onHoldSection")}
            </Text>
            {heldLines.map((line) => (
              <TicketLineRow key={`held-${line.id}`} line={line} editable={!closed} />
            ))}
          </View>
        ) : null}

        {rounds.map(([round, lines]) => (

          <View key={round} className="mb-4">

            <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Round {round}</Text>

            {lines.map((line) => (

              <TicketLineRow
                key={line.id}
                line={line}
                editable={!closed}
                onModify={() => setModifyLine(line)}
                onRemovePending={() => removeLineMut.mutate(line.id)}
              />

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

          {discountTotal > 0 ? (
            <View className="mt-1 flex-row justify-between">
              <Text className="text-slate-600">Discounts</Text>
              <Text className="font-medium text-amber-700">- {discountTotal.toFixed(2)}</Text>
            </View>
          ) : null}

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
              onPress={handleSendKitchen}
              className="mb-3 min-h-[44px] rounded-xl border border-slate-300 py-3"
            >
              <Text allowFontScaling={false} className="text-center font-semibold text-slate-800">
                {kitchenMut.isPending ? "…" : t("sendToKitchen")}
              </Text>
            </Pressable>

            {heldCourses.map((course) => (
              <Pressable
                key={course}
                disabled={fireMut.isPending}
                onPress={() => fireMut.mutate(course)}
                className="mb-2 min-h-[44px] rounded-xl bg-orange-500 py-3"
              >
                <Text allowFontScaling={false} className="text-center font-semibold text-white">
                  🔥 {t("fireCourse", { course })}
                </Text>
              </Pressable>
            ))}

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

      <VoidDiscountModal
        visible={!!modifyLine}
        line={modifyLine}
        ticketId={ticketId!}
        hotelId={hotelId}
        onClose={() => setModifyLine(null)}
        onSuccess={(updated) => {
          setModifyLine(null);
          void queryClient.setQueryData(["pos-ticket", hotelId, ticketId], updated);
        }}
      />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setMenuOpen(false)}>
          <View className="absolute right-4 top-24 min-w-[220px] rounded-xl bg-white p-2 shadow-lg" style={{ marginTop: headerPad }}>
            {canTransfer ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setTransferOpen(true);
                }}
                className="rounded-lg px-4 py-3"
              >
                <Text className="font-medium text-slate-900">Move to Another Table</Text>
              </Pressable>
            ) : null}
            {canMerge ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setMergeOpen(true);
                }}
                className="rounded-lg px-4 py-3"
              >
                <Text className="font-medium text-slate-900">Merge With Another Table</Text>
              </Pressable>
            ) : null}
            {canCancelOpen ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setCancelOpen(true);
                }}
                className="rounded-lg px-4 py-3"
              >
                <Text className="font-medium text-red-600">Cancel Ticket</Text>
              </Pressable>
            ) : (
              <View className="px-4 py-3">
                <Text className="text-sm text-slate-600">
                  To cancel after kitchen send, contact your manager.
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      <CancelTicketModal
        visible={cancelOpen}
        ticket={ticket}
        pendingLines={pendingLines}
        tableLabel={ticket?.tableLabel ?? "Table"}
        hotelId={hotelId}
        ticketId={ticketId}
        isLocalOnly={isLocalTicket}
        busy={cancelMut.isPending}
        onClose={() => setCancelOpen(false)}
        onConfirmLocal={handleCancelLocal}
        onConfirmServer={() => cancelMut.mutate()}
      />

      <TablePickerModal
        visible={transferOpen}
        title="Move to another table"
        tables={posTables}
        currentTableId={ticket?.tableId}
        onClose={() => setTransferOpen(false)}
        onSelect={(table) => {
          Alert.alert(
            "Move ticket?",
            `Move ticket from Table ${ticket?.tableLabel} to Table ${table.tableLabel}?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Move", onPress: () => transferMut.mutate(table.id) },
            ],
          );
        }}
      />

      <MergeTicketModal
        visible={mergeOpen}
        currentTicketId={ticketId ?? ""}
        currentTableLabel={ticket?.tableLabel ?? ""}
        tickets={openTickets}
        loading={openTicketsLoading}
        onClose={() => setMergeOpen(false)}
        onSelect={(source) => {
          Alert.alert(
            "Merge tables?",
            `Merge Table ${source.tableLabel} into Table ${ticket?.tableLabel}?\n\nAll ${source.lineCount} items from Table ${source.tableLabel} will be moved here. Table ${source.tableLabel} will be freed.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Merge", onPress: () => mergeMut.mutate(source.id) },
            ],
          );
        }}
      />

    </View>

  );

}

