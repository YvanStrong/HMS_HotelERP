/* @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

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
          customerName: tableLabel ?? ticket?.tableLabel ?? t("walkInCustomer"),
          tipAmount: tip > 0 ? tip : undefined,
        });
        if (res?.saleNumber) {
          finish(t("paidInvoice", { number: res.saleNumber }), res, method);
        } else if (res) {
          finish(t("ticketClosedSale"), res, method);
        } else {
          finish(t("savedOffline"), null);
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
      finish(t("paidInvoice", { number: res.saleNumber }));
    } catch (err) {
      Toast.show({ type: "error", text1: t("paymentFailed"), text2: apiErrorMessage(err) });
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
            ? t("chargedToRoom", {
                room: selectedReservation.roomNumber ?? "?",
                number: res.saleNumber,
              })
            : t("chargedToRoomNoInvoice", { room: selectedReservation.roomNumber ?? "?" }),
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
      finish(
        t("chargedToRoom", {
          room: selectedReservation.roomNumber ?? "?",
          number: res.saleNumber,
        }),
      );
    } catch (err) {
      Toast.show({ type: "error", text1: t("roomChargeFailed"), text2: apiErrorMessage(err) });
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
          customerName: tableLabel ?? ticket?.tableLabel ?? t("walkInCustomer"),
        });
        finish(
          res?.deliveryNumber
            ? t("deliveryBillLater", { number: res.deliveryNumber })
            : t("orderSentDeliveries"),
          res,
        );
        return;
      }
      const payload = buildDeliveryPayload({
        depotId: depot.id,
        lines: pendingLines,
        tableLabel,
        customerName: tableLabel ?? t("walkInCustomer"),
        staffId,
        paymentNote: t("billLater"),
      });
      const res = await createDelivery(hotelId, payload);
      finish(t("deliverySent", { number: res.deliveryNumber }));
    } catch (err) {
      Toast.show({ type: "error", text1: t("couldNotSendOrder"), text2: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const hasItems = ticketLines.length > 0 || pendingLines.length > 0;

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex1}
      >
        <View style={styles.flex1}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {ticketId ? t("closeTicketTitle") : t("paymentTitle")}
              </Text>
              {ticket?.tableLabel ? <Text style={styles.headerSub}>{ticket.tableLabel}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {hasItems ? (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>{t("orderItems")}</Text>
                {ticketLines.map((line) => (
                  <View key={line.id} style={styles.lineRow}>
                    <View style={styles.lineMain}>
                      <Text style={styles.lineTitle}>
                        {line.quantity}× {line.productName}
                      </Text>
                      {line.notes ? <Text style={styles.lineNote}>{line.notes}</Text> : null}
                    </View>
                    <Text style={styles.lineAmount}>{money(line.lineTotal).toFixed(2)}</Text>
                  </View>
                ))}
                {pendingLines.map((line) => (
                  <View key={`pending-${line.productId}`} style={styles.pendingRow}>
                    <View style={styles.lineMain}>
                      <Text style={styles.lineTitle}>
                        {line.qty}× {line.productName}
                      </Text>
                      <Text style={styles.pendingTag}>{t("pendingRound")}</Text>
                    </View>
                    <Text style={styles.lineAmount}>{(line.unitPrice * line.qty).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>{t("payNow")}</Text>
            <View style={styles.payRow}>
              <Pressable
                disabled={busy || !hasItems}
                onPress={() => selectPayMethod("CASH")}
                style={[
                  styles.payBtn,
                  payMethod === "CASH"
                    ? styles.payBtnCashActive
                    : hasItems
                      ? styles.payBtnCash
                      : styles.payBtnDisabled,
                ]}
              >
                <Text style={styles.payBtnText}>{t("cash")}</Text>
              </Pressable>
              <Pressable
                disabled={busy || !hasItems}
                onPress={() => selectPayMethod("CARD")}
                style={[
                  styles.payBtn,
                  payMethod === "CARD"
                    ? styles.payBtnCardActive
                    : hasItems
                      ? styles.payBtnCard
                      : styles.payBtnDisabled,
                ]}
              >
                <Text style={styles.payBtnText}>{t("card")}</Text>
              </Pressable>
            </View>

            {payMethod ? (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>{t("addTipOptional")}</Text>
                <View style={styles.tipRow}>
                  {([10, 15, 20] as const).map((pct) => (
                    <Pressable
                      key={pct}
                      onPress={() => setTipPreset(pct)}
                      style={[styles.tipChip, tipPreset === pct && styles.tipChipActive]}
                    >
                      <Text style={[styles.tipChipText, tipPreset === pct && styles.tipChipTextActive]}>
                        {pct}%
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => setTipPreset("custom")}
                    style={[styles.tipChip, tipPreset === "custom" && styles.tipChipActive]}
                  >
                    <Text style={[styles.tipChipText, tipPreset === "custom" && styles.tipChipTextActive]}>
                      {t("custom")}
                    </Text>
                  </Pressable>
                </View>
                {tipPreset !== null && tipPreset !== "none" && tipPreset !== "custom" ? (
                  <Text style={styles.tipAmount}>= {fmtRwf(tipAmount)}</Text>
                ) : null}
                {tipPreset === "custom" ? (
                  <View style={styles.customTipWrap}>
                    <Text style={styles.customTipLabel}>{t("enterTipAmount")}</Text>
                    <TextInput
                      value={customTip}
                      onChangeText={setCustomTip}
                      keyboardType="decimal-pad"
                      style={styles.customTipInput}
                      placeholder="0"
                    />
                  </View>
                ) : null}
                <Pressable onPress={() => setTipPreset("none")} style={styles.noTipBtn}>
                  <Text style={styles.noTipText}>{t("noTip")}</Text>
                </Pressable>

                <View style={styles.totalsBox}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t("subtotal")}</Text>
                    <Text style={styles.totalValue}>{fmtRwf(subtotal)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t("tax")}</Text>
                    <Text style={styles.totalValue}>{fmtRwf(tax)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t("tip")}</Text>
                    <Text style={styles.totalValue}>{fmtRwf(tipAmount)}</Text>
                  </View>
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>{t("total")}</Text>
                    <Text style={styles.grandTotalValue}>{fmtRwf(grandTotal)}</Text>
                  </View>
                </View>

                <Pressable
                  disabled={busy}
                  onPress={() => void submitPayNow(payMethod, tipAmount)}
                  style={styles.confirmBtn}
                >
                  <Text style={styles.confirmBtnText}>
                    {t("confirmPaymentAmount", { amount: fmtRwf(grandTotal) })}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t("subtotal")}</Text>
                  <Text style={styles.totalValue}>{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t("tax")}</Text>
                  <Text style={styles.totalValue}>{tax.toFixed(2)}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>{t("total")}</Text>
                  <Text style={styles.grandTotalValueLarge}>{total.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>{t("chargeToRoom")}</Text>
            <TextInput
              value={roomQuery}
              onChangeText={setRoomQuery}
              placeholder={t("searchGuestRoom")}
              style={styles.searchInput}
            />
            {filteredReservations.slice(0, 8).map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setSelectedReservation(r)}
                style={[
                  styles.roomRow,
                  selectedReservation?.id === r.id && styles.roomRowSelected,
                ]}
              >
                <Text style={styles.roomRowText}>
                  {t("roomGuestLine", { room: r.roomNumber ?? "—", name: r.guestName })}
                </Text>
              </Pressable>
            ))}
            {guestHits.slice(0, 4).map((g) => (
              <Text key={g.guest?.id ?? g.guest?.email} style={styles.guestHit}>
                {t("guestLabel", {
                  name: g.guest?.fullName ?? g.guest?.full_name ?? g.guest?.email ?? "—",
                })}
              </Text>
            ))}
            <Pressable
              disabled={busy || !selectedReservation || !hasItems}
              onPress={() => void submitRoomCharge()}
              style={[
                styles.roomChargeBtn,
                selectedReservation && hasItems ? styles.roomChargeBtnOn : styles.payBtnDisabled,
              ]}
            >
              <Text style={styles.payBtnText}>{t("chargeToRoom")}</Text>
            </Pressable>

            <Pressable
              disabled={busy || !hasItems}
              onPress={() => void submitBillLater()}
              style={[styles.billLaterBtn, hasItems ? styles.billLaterBtnOn : styles.billLaterBtnOff]}
            >
              <Text style={[styles.billLaterTitle, hasItems ? styles.billLaterTitleOn : styles.billLaterTitleOff]}>
                {t("billLaterDelivery")}
              </Text>
              <Text style={[styles.billLaterHint, hasItems ? styles.billLaterHintOn : styles.billLaterHintOff]}>
                {t("billLaterDeliveryHint")}
              </Text>
            </Pressable>
          </ScrollView>

          {busy ? (
            <View style={styles.busyOverlay}>
              <ActivityIndicator size="large" color="#4f46e5" />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: "#f8fafc",
  },
  flex1: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  headerSub: { fontSize: 14, color: "#64748b", marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 16,
  },
  sectionLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e7ff",
  },
  lineMain: { flex: 1, paddingRight: 8 },
  lineTitle: { fontWeight: "500", color: "#0f172a" },
  lineNote: { fontSize: 12, color: "#64748b", marginTop: 2 },
  pendingTag: { fontSize: 12, color: "#4f46e5", marginTop: 2 },
  lineAmount: { fontWeight: "600", color: "#1e293b" },
  payRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  payBtn: { flex: 1, borderRadius: 12, padding: 16 },
  payBtnCash: { backgroundColor: "#059669" },
  payBtnCashActive: { backgroundColor: "#047857" },
  payBtnCard: { backgroundColor: "#4f46e5" },
  payBtnCardActive: { backgroundColor: "#4338ca" },
  payBtnDisabled: { backgroundColor: "#cbd5e1" },
  payBtnText: { textAlign: "center", fontWeight: "600", color: "#fff" },
  tipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tipChip: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#f1f5f9" },
  tipChipActive: { backgroundColor: "#4f46e5" },
  tipChipText: { fontWeight: "600", color: "#334155" },
  tipChipTextActive: { color: "#fff" },
  tipAmount: { marginBottom: 8, fontSize: 14, fontWeight: "500", color: "#4f46e5" },
  customTipWrap: { marginBottom: 8 },
  customTipLabel: { marginBottom: 4, fontSize: 12, color: "#64748b" },
  customTipInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "600",
  },
  noTipBtn: { paddingVertical: 4 },
  noTipText: { textAlign: "center", fontSize: 14, color: "#64748b", textDecorationLine: "underline" },
  totalsBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { color: "#475569" },
  totalValue: { fontWeight: "500", color: "#0f172a" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  grandTotalLabel: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  grandTotalValue: { fontSize: 20, fontWeight: "700", color: "#4f46e5" },
  grandTotalValueLarge: { fontSize: 24, fontWeight: "700", color: "#4f46e5" },
  confirmBtn: {
    marginTop: 16,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    paddingVertical: 16,
  },
  confirmBtnText: { fontWeight: "600", color: "#fff" },
  searchInput: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roomRow: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    padding: 12,
  },
  roomRowSelected: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  roomRowText: { fontWeight: "600", color: "#0f172a" },
  guestHit: { marginBottom: 4, fontSize: 12, color: "#64748b" },
  roomChargeBtn: { marginBottom: 24, borderRadius: 12, padding: 16 },
  roomChargeBtnOn: { backgroundColor: "#7c3aed" },
  billLaterBtn: { marginBottom: 32, borderRadius: 12, borderWidth: 1, padding: 16 },
  billLaterBtnOn: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  billLaterBtnOff: { borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" },
  billLaterTitle: { textAlign: "center", fontWeight: "600" },
  billLaterTitleOn: { color: "#92400e" },
  billLaterTitleOff: { color: "#94a3b8" },
  billLaterHint: { marginTop: 4, textAlign: "center", fontSize: 12 },
  billLaterHintOn: { color: "#b45309" },
  billLaterHintOff: { color: "#94a3b8" },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
});
