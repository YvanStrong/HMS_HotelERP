import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { searchGuests } from "../api/guests";
import { fetchCheckedInReservations } from "../api/reservations";
import { buildDeliveryPayload, buildSalePayload, createDelivery, createSale } from "../api/orders";
import { addLinesAction, closeTicketAction } from "../api/posActions";
import { apiErrorMessage } from "../api/client";
import { money, type TicketDetail } from "../api/tickets";
import type { GuestSearchHit, ReservationListItem } from "../types";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import { buildClosedSummary, saveLastClosedTicket } from "../storage/lastReceipt";

type PayMethod = "CASH" | "CARD";
type TipPreset = 10 | 15 | 20 | "custom" | "none" | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (message: string, closedTicket?: TicketDetail | null) => void;
  ticketId?: string | null;
  ticket?: TicketDetail | null;
};

function fmtRwf(n: number): string {
  return `RWF ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PaymentModal({ visible, onClose, onSuccess, ticketId, ticket }: Props) {
  const hotelId = useAuthStore((s) => s.user?.hotelId);
  const staffId = useAuthStore((s) => s.user?.id);
  const depot = useCartStore((s) => s.selectedDepot);
  const tableLabel = useCartStore((s) => s.tableLabel);
  const pendingLines = useCartStore((s) => s.lines);
  const pendingSubtotal = useCartStore((s) => s.subtotal());
  const pendingTax = useCartStore((s) => s.tax());
  const pendingTotal = useCartStore((s) => s.total());
  const clearCart = useCartStore((s) => s.clearCart);
  const clearPendingLines = useCartStore((s) => s.clearPendingLines);

  const [busy, setBusy] = useState(false);
  const [roomQuery, setRoomQuery] = useState("");
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [guestHits, setGuestHits] = useState<GuestSearchHit[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationListItem | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [tipPreset, setTipPreset] = useState<TipPreset>(null);
  const [customTip, setCustomTip] = useState("");

  const ticketLines = useMemo(
    () => (ticket?.lines ?? []).filter((l) => l.lineStatus !== "CANCELLED"),
    [ticket?.lines],
  );

  const { subtotal, tax, total } = useMemo(() => {
    const fromTicketSub = money(ticket?.subtotal);
    const fromTicketTax = money(ticket?.taxAmount);
    const fromTicketTotal = money(ticket?.totalAmount);

    let sub = fromTicketSub + pendingSubtotal;
    let t = fromTicketTax + pendingTax;
    let tot = fromTicketTotal + pendingTotal;

    if (ticketLines.length > 0 && sub === 0) {
      sub = ticketLines.reduce((s, l) => s + money(l.lineTotal), 0);
    }
    if (ticketLines.length > 0 && tot === 0) {
      tot = sub + t;
    }
    if (ticketLines.length > 0 && t === 0 && sub > 0 && fromTicketTotal > sub) {
      t = fromTicketTotal - fromTicketSub;
    }

    return { subtotal: sub, tax: t, total: tot || sub + t };
  }, [ticket, ticketLines, pendingSubtotal, pendingTax, pendingTotal]);

  const tipAmount = useMemo(() => {
    if (tipPreset === "none" || tipPreset === null) return 0;
    if (tipPreset === "custom") return money(customTip);
    return Math.round((subtotal * tipPreset) / 100);
  }, [tipPreset, customTip, subtotal]);

  const grandTotal = total + tipAmount;

  useEffect(() => {
    if (!visible) {
      setPayMethod(null);
      setTipPreset(null);
      setCustomTip("");
      return;
    }
    if (!hotelId) return;
    void fetchCheckedInReservations(hotelId).then(setReservations).catch(() => setReservations([]));
  }, [visible, hotelId]);

  useEffect(() => {
    if (!visible || !hotelId || roomQuery.trim().length < 2) {
      setGuestHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchGuests(hotelId, roomQuery).then(setGuestHits).catch(() => setGuestHits([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [roomQuery, visible, hotelId]);

  const filteredReservations = reservations.filter((r) => {
    const q = roomQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      r.guestName?.toLowerCase().includes(q) ||
      r.roomNumber?.toLowerCase().includes(q) ||
      r.booking_reference?.toLowerCase().includes(q)
    );
  });

  async function flushPendingLines() {
    if (!hotelId || !ticketId || pendingLines.length === 0) return;
    await addLinesAction(hotelId, ticketId, pendingLines);
    clearPendingLines();
  }

  function finish(message: string, closed?: TicketDetail | null, paymentMethod?: string) {
    if (closed && depot) {
      saveLastClosedTicket(buildClosedSummary(closed, depot.name, paymentMethod));
    }
    clearCart();
    onClose();
    onSuccess(message, closed ?? null);
  }

  function selectPayMethod(method: PayMethod) {
    setPayMethod(method);
    if (tipPreset === null) setTipPreset("none");
  }

  async function submitPayNow(method: "CASH" | "CARD", tip: number) {
    if (!hotelId || !depot) return;
    if (!ticketId && pendingLines.length === 0) return;
    setBusy(true);
    try {
      if (ticketId) {
        await flushPendingLines();
        const res = await closeTicketAction(hotelId, ticketId, {
          mode: method,
          paymentMethod: method,
          customerName: tableLabel ?? ticket?.tableLabel ?? "Walk-in",
          tipAmount: tip > 0 ? tip : undefined,
        });
        if (res?.saleNumber) {
          finish(`Paid — invoice ${res.saleNumber}`, res, method);
        } else if (res) {
          finish("Ticket closed — sale recorded", res, method);
        } else {
          finish("Saved offline — will sync when connected", null);
        }
        return;
      }
      const payload = buildSalePayload({
        depotId: depot.id,
        lines: pendingLines,
        tableLabel,
        paymentMethod: method,
        staffId,
      });
      const res = await createSale(hotelId, payload);
      finish(`Paid — invoice ${res.saleNumber}`);
    } catch (err) {
      Toast.show({ type: "error", text1: "Payment failed", text2: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function submitRoomCharge() {
    if (!hotelId || !depot || !selectedReservation) return;
    if (!ticketId && pendingLines.length === 0) return;
    setBusy(true);
    try {
      if (ticketId) {
        await flushPendingLines();
        const res = await closeTicketAction(hotelId, ticketId, {
          mode: "CHARGE_ROOM",
          chargeToRoom: true,
          reservationId: selectedReservation.id,
          customerName: selectedReservation.guestName ?? undefined,
          paymentMethod: "ROOM",
        });
        finish(
          res?.saleNumber
            ? `Charged to room ${selectedReservation.roomNumber ?? "?"} — ${res.saleNumber}`
            : `Charged to room ${selectedReservation.roomNumber ?? "?"}`,
          res,
          "ROOM",
        );
        return;
      }
      const payload = buildSalePayload({
        depotId: depot.id,
        lines: pendingLines,
        tableLabel,
        customerName: selectedReservation.guestName ?? undefined,
        chargeToRoom: true,
        reservationId: selectedReservation.id,
        staffId,
      });
      const res = await createSale(hotelId, payload);
      finish(`Charged to room ${selectedReservation.roomNumber ?? "?"} — ${res.saleNumber}`);
    } catch (err) {
      Toast.show({ type: "error", text1: "Room charge failed", text2: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function submitBillLater() {
    if (!hotelId || !depot) return;
    if (!ticketId && pendingLines.length === 0) return;
    setBusy(true);
    try {
      if (ticketId) {
        await flushPendingLines();
        const res = await closeTicketAction(hotelId, ticketId, {
          mode: "BILL_LATER",
          customerName: tableLabel ?? ticket?.tableLabel ?? "Walk-in",
        });
        finish(
          res?.deliveryNumber
            ? `Bill later — delivery ${res.deliveryNumber} (HMS Invoices → Deliveries)`
            : "Order sent — ticket is open on Deliveries",
          res,
        );
        return;
      }
      const payload = buildDeliveryPayload({
        depotId: depot.id,
        lines: pendingLines,
        tableLabel,
        customerName: tableLabel ?? "Walk-in",
        staffId,
        paymentNote: "Bill later",
      });
      const res = await createDelivery(hotelId, payload);
      finish(`Delivery ${res.deliveryNumber} sent — HMS Invoices → Deliveries`);
    } catch (err) {
      Toast.show({ type: "error", text1: "Could not send order", text2: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const hasItems = ticketLines.length > 0 || pendingLines.length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
          <View>
            <Text className="text-lg font-bold text-slate-900">
              {ticketId ? "Close ticket" : "Payment"}
            </Text>
            {ticket?.tableLabel ? (
              <Text className="text-sm text-slate-500">{ticket.tableLabel}</Text>
            ) : null}
          </View>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color="#64748b" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {hasItems ? (
            <View className="mb-4 rounded-2xl bg-white p-4">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Order items</Text>
              {ticketLines.map((line) => (
                <View key={line.id} className="mb-2 flex-row items-start justify-between border-b border-slate-100 pb-2">
                  <View className="flex-1 pr-2">
                    <Text className="font-medium text-slate-900">
                      {line.quantity}× {line.productName}
                    </Text>
                    {line.notes ? <Text className="text-xs text-slate-500">{line.notes}</Text> : null}
                  </View>
                  <Text className="font-semibold text-slate-800">{money(line.lineTotal).toFixed(2)}</Text>
                </View>
              ))}
              {pendingLines.map((line) => (
                <View
                  key={`pending-${line.productId}`}
                  className="mb-2 flex-row items-start justify-between border-b border-indigo-100 pb-2"
                >
                  <View className="flex-1 pr-2">
                    <Text className="font-medium text-slate-900">
                      {line.qty}× {line.productName}
                    </Text>
                    <Text className="text-xs text-indigo-600">Pending round</Text>
                  </View>
                  <Text className="font-semibold text-slate-800">
                    {(line.unitPrice * line.qty).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text className="mb-2 text-sm font-semibold text-slate-700">Pay now</Text>
          <View className="mb-4 flex-row gap-3">
            <Pressable
              disabled={busy || !hasItems}
              onPress={() => selectPayMethod("CASH")}
              className={`flex-1 rounded-xl p-4 ${
                payMethod === "CASH" ? "bg-emerald-700 ring-2 ring-emerald-300" : hasItems ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <Text className="text-center font-semibold text-white">Cash</Text>
            </Pressable>
            <Pressable
              disabled={busy || !hasItems}
              onPress={() => selectPayMethod("CARD")}
              className={`flex-1 rounded-xl p-4 ${
                payMethod === "CARD" ? "bg-indigo-700 ring-2 ring-indigo-300" : hasItems ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <Text className="text-center font-semibold text-white">Card</Text>
            </Pressable>
          </View>

          {payMethod ? (
            <View className="mb-4 rounded-2xl bg-white p-4">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Add a tip? (Optional)</Text>
              <View className="mb-2 flex-row flex-wrap gap-2">
                {([10, 15, 20] as const).map((pct) => (
                  <Pressable
                    key={pct}
                    onPress={() => setTipPreset(pct)}
                    className={`rounded-lg px-4 py-2 ${
                      tipPreset === pct ? "bg-indigo-600" : "bg-slate-100"
                    }`}
                  >
                    <Text className={`font-semibold ${tipPreset === pct ? "text-white" : "text-slate-700"}`}>
                      {pct}%
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setTipPreset("custom")}
                  className={`rounded-lg px-4 py-2 ${tipPreset === "custom" ? "bg-indigo-600" : "bg-slate-100"}`}
                >
                  <Text className={`font-semibold ${tipPreset === "custom" ? "text-white" : "text-slate-700"}`}>
                    Custom
                  </Text>
                </Pressable>
              </View>
              {tipPreset !== null && tipPreset !== "none" && tipPreset !== "custom" ? (
                <Text className="mb-2 text-sm font-medium text-indigo-600">= {fmtRwf(tipAmount)}</Text>
              ) : null}
              {tipPreset === "custom" ? (
                <View className="mb-2">
                  <Text className="mb-1 text-xs text-slate-500">Enter tip amount (RWF)</Text>
                  <TextInput
                    value={customTip}
                    onChangeText={setCustomTip}
                    keyboardType="decimal-pad"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold"
                    placeholder="0"
                  />
                </View>
              ) : null}
              <Pressable onPress={() => setTipPreset("none")} className="py-1">
                <Text className="text-center text-sm text-slate-500 underline">No tip</Text>
              </Pressable>

              <View className="mt-4 border-t border-slate-200 pt-3">
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600">Subtotal</Text>
                  <Text className="font-medium text-slate-900">{fmtRwf(subtotal)}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600">Tax</Text>
                  <Text className="font-medium text-slate-900">{fmtRwf(tax)}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600">Tip</Text>
                  <Text className="font-medium text-slate-900">{fmtRwf(tipAmount)}</Text>
                </View>
                <View className="mt-2 flex-row justify-between border-t border-slate-200 pt-2">
                  <Text className="text-base font-bold text-slate-900">TOTAL</Text>
                  <Text className="text-xl font-bold text-indigo-600">{fmtRwf(grandTotal)}</Text>
                </View>
              </View>

              <Pressable
                disabled={busy}
                onPress={() => void submitPayNow(payMethod, tipAmount)}
                className="mt-4 items-center rounded-xl bg-indigo-600 py-4"
              >
                <Text className="font-semibold text-white">Confirm Payment — {fmtRwf(grandTotal)}</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mb-4 rounded-2xl bg-white p-4">
              <View className="flex-row justify-between">
                <Text className="text-slate-600">Subtotal</Text>
                <Text className="font-medium text-slate-900">{subtotal.toFixed(2)}</Text>
              </View>
              <View className="mt-2 flex-row justify-between">
                <Text className="text-slate-600">Tax</Text>
                <Text className="font-medium text-slate-900">{tax.toFixed(2)}</Text>
              </View>
              <View className="mt-3 flex-row justify-between border-t border-slate-200 pt-3">
                <Text className="text-base font-bold text-slate-900">Total</Text>
                <Text className="text-2xl font-bold text-indigo-600">{total.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <Text className="mb-2 text-sm font-semibold text-slate-700">Charge to room</Text>
          <TextInput
            value={roomQuery}
            onChangeText={setRoomQuery}
            placeholder="Search guest or room number"
            className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
          />
          {filteredReservations.slice(0, 8).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setSelectedReservation(r)}
              className={`mb-2 rounded-xl border p-3 ${
                selectedReservation?.id === r.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"
              }`}
            >
              <Text className="font-semibold text-slate-900">
                Room {r.roomNumber ?? "—"} · {r.guestName}
              </Text>
            </Pressable>
          ))}
          {guestHits.slice(0, 4).map((g) => (
            <Text key={g.guest?.id ?? g.guest?.email} className="mb-1 text-xs text-slate-500">
              Guest: {g.guest?.fullName ?? g.guest?.full_name ?? g.guest?.email ?? "—"}
            </Text>
          ))}
          <Pressable
            disabled={busy || !selectedReservation || !hasItems}
            onPress={() => void submitRoomCharge()}
            className={`mb-6 rounded-xl p-4 ${selectedReservation && hasItems ? "bg-violet-600" : "bg-slate-300"}`}
          >
            <Text className="text-center font-semibold text-white">Charge to room</Text>
          </Pressable>

          <Pressable
            disabled={busy || !hasItems}
            onPress={() => void submitBillLater()}
            className={`mb-8 rounded-xl border p-4 ${
              hasItems ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-100"
            }`}
          >
            <Text className={`text-center font-semibold ${hasItems ? "text-amber-800" : "text-slate-400"}`}>
              Bill later (delivery)
            </Text>
            <Text className={`mt-1 text-center text-xs ${hasItems ? "text-amber-700" : "text-slate-400"}`}>
              Appears on HMS Invoices → Deliveries until cashier converts
            </Text>
          </Pressable>
        </ScrollView>

        {busy ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
