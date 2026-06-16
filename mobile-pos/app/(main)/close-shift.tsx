import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useShiftElapsedMinutes } from "../../src/hooks/useShiftElapsedMinutes";
import { formatShiftDuration, parseApiInstant } from "../../src/lib/shiftDuration";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { apiErrorMessage } from "../../src/api/client";
import {
  closeShift,
  getShiftSummary,
  money,
  type PosShiftSummaryDTO,
} from "../../src/api/shifts";
import { PrintShiftModal } from "../../src/components/PrintShiftModal";
import { ScreenHeaderActions } from "../../src/components/ScreenHeaderActions";
import { printShiftSummary } from "../../src/printing/PrinterService";
import { useAuthStore } from "../../src/store/authStore";
import { useCartStore } from "../../src/store/cartStore";
import { useShiftStore } from "../../src/store/shiftStore";
import {
  computeCashVariance,
  computeExpectedCash,
  varianceLabel,
} from "../../src/lib/cashReconciliation";

function fmtMoney(v: number | string): string {
  return `RWF ${money(v).toLocaleString()}`;
}

export default function CloseShiftScreen() {
  const router = useRouter();
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const user = useAuthStore((s) => s.user);
  const activeShift = useShiftStore((s) => s.activeShift);
  const clearShift = useShiftStore((s) => s.clearShift);
  const depot = useCartStore((s) => s.selectedDepot);

  const [closingCashText, setClosingCashText] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [printModal, setPrintModal] = useState(false);
  const [closedSummary, setClosedSummary] = useState<PosShiftSummaryDTO | null>(null);
  const [openTablesModal, setOpenTablesModal] = useState<string[] | null>(null);

  const shiftId = activeShift?.id;
  const openedMs = activeShift ? parseApiInstant(activeShift.openedAt) : null;
  const elapsedMinutes = useShiftElapsedMinutes(activeShift?.openedAt, !!activeShift);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["shift-summary", hotelId, shiftId],
    queryFn: () => getShiftSummary(hotelId, shiftId!),
    enabled: !!hotelId && !!shiftId,
    refetchInterval: 10_000,
  });

  const openingFloat = summary?.openingFloat ?? activeShift?.openingFloat ?? 0;
  const totalCashSales = summary?.totalCash ?? 0;
  const expectedCash =
    summary?.expectedCash != null
      ? money(summary.expectedCash)
      : computeExpectedCash(openingFloat, totalCashSales);
  const closingCash = money(closingCashText);
  const variance = closingCashText ? computeCashVariance(expectedCash, closingCash) : 0;

  const balanceHint = useMemo(() => {
    if (!closingCashText || !summary) return null;
    return varianceLabel(variance);
  }, [closingCashText, summary, variance]);

  async function submitClose(withPrint: boolean) {
    if (!shiftId || !summary) return;
    setBusy(true);
    try {
      const result = await closeShift(hotelId, shiftId, closingCash, notes);
      clearShift();
      setClosedSummary(result);
      if (withPrint) {
        setPrintModal(true);
      } else {
        router.replace("/(main)/outlets");
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; fields?: { tables?: string } } } };
      if (ax.response?.data?.error === "OPEN_TICKETS_EXIST") {
        const tables = ax.response.data.fields?.tables?.split(", ") ?? [];
        setOpenTablesModal(tables);
        return;
      }
      Toast.show({ type: "error", text1: "Could not close shift", text2: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function doClose(withPrint: boolean) {
    if (!shiftId || !summary || !closingCashText) return;

    const hint = varianceLabel(variance);
    if (hint.status !== "BALANCED") {
      Alert.alert(
        hint.status === "OVERAGE" ? "Cash overage" : "Cash shortage",
        `${hint.text}\n\nExpected in drawer: RWF ${expectedCash.toLocaleString()}\n` +
          `You counted: RWF ${closingCash.toLocaleString()}\n\nClose shift anyway?`,
        [
          { text: "Recount", style: "cancel" },
          { text: "Close anyway", style: "destructive", onPress: () => void submitClose(withPrint) },
        ],
      );
      return;
    }

    void submitClose(withPrint);
  }

  if (!activeShift || activeShift.status !== "OPEN") {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="mb-4 text-center text-slate-600">No open shift. Select an outlet to start one.</Text>
        <Pressable onPress={() => router.push("/(main)/outlets")} className="rounded-xl bg-indigo-600 px-4 py-3">
          <Text className="font-semibold text-white">Choose outlet</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-12">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-900">Close Shift</Text>
            <Text className="text-sm text-slate-500">
              Started at {activeShift.depotName} · all outlets included
            </Text>
            <Text className="text-sm text-slate-500">
              Opened {openedMs != null ? new Date(openedMs).toLocaleString() : "—"} ·{" "}
              {formatShiftDuration(elapsedMinutes)}
            </Text>
          </View>
          <ScreenHeaderActions />
        </View>
      </View>

      {isLoading || !summary ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-4">
          <View className="mb-4 rounded-xl bg-white p-4">
            <Text className="mb-2 font-semibold text-slate-800">Live Summary</Text>
            <Text className="text-slate-700">Orders completed: {summary.totalOrders}</Text>
            <Text className="text-slate-700">Tables served: {summary.tickets.length}</Text>
            <Text className="text-slate-700">Covers (guests): {summary.totalCovers}</Text>
            <View className="my-3 border-t border-slate-100" />
            <Text className="text-slate-700">Cash sales: {fmtMoney(summary.totalCash)}</Text>
            <Text className="text-slate-700">Card sales: {fmtMoney(summary.totalCard)}</Text>
            <Text className="text-slate-700">Room charges: {fmtMoney(summary.totalRoomCharge)}</Text>
            <View className="my-3 border-t border-slate-100" />
            <Text className="text-2xl font-bold text-indigo-600">
              Total Revenue: {fmtMoney(summary.totalRevenue)}
            </Text>
            <Text className="text-slate-700">Total Tax: {fmtMoney(summary.totalTax)}</Text>
            <View className="my-3 border-t border-slate-100" />
            <Text className="text-slate-600">Cancelled tickets: {summary.totalCancelled}</Text>
            <Text className="text-slate-600">Avg ticket value: {fmtMoney(summary.avgTicketValue)}</Text>
          </View>

          {(summary.revenueByDepot?.length ?? 0) > 0 ? (
            <View className="mb-4 rounded-xl bg-white p-4">
              <Text className="mb-2 font-semibold text-slate-800">Sales by outlet</Text>
              {summary.revenueByDepot!.map((row) => (
                <View key={row.depotId} className="flex-row justify-between py-1">
                  <Text className="text-slate-700">
                    {row.depotName} ({row.orderCount} orders)
                  </Text>
                  <Text className="font-medium text-slate-900">{fmtMoney(row.revenue)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {summary.topItems.length > 0 ? (
            <View className="mb-4 rounded-xl bg-white p-4">
              <Text className="mb-2 font-semibold text-slate-800">Top Items This Shift</Text>
              {summary.topItems.map((item) => (
                <Text key={item.productName} className="py-1 text-slate-700">
                  {item.productName} — {item.qtySold} sold — {fmtMoney(item.revenue)}
                </Text>
              ))}
            </View>
          ) : null}

          <View className="mb-4 rounded-xl bg-white p-4">
            <Text className="mb-2 font-semibold text-slate-800">Cash Reconciliation</Text>
            <Text className="text-slate-600 text-sm mb-3">
              Count all cash in the drawer and compare to opening float plus cash sales.
            </Text>
            <View className="rounded-lg bg-slate-50 p-3">
              <View className="flex-row justify-between py-1">
                <Text className="text-slate-700">Opening float</Text>
                <Text className="font-medium text-slate-900">{fmtMoney(openingFloat)}</Text>
              </View>
              <View className="flex-row justify-between py-1">
                <Text className="text-slate-700">+ Cash sales</Text>
                <Text className="font-medium text-slate-900">{fmtMoney(totalCashSales)}</Text>
              </View>
              <View className="my-2 border-t border-slate-200" />
              <View className="flex-row justify-between py-1">
                <Text className="font-semibold text-slate-800">Expected in drawer</Text>
                <Text className="text-lg font-bold text-indigo-600">{fmtMoney(expectedCash)}</Text>
              </View>
            </View>
            <View className="my-3 border-t border-slate-100" />
            <Text className="mb-2 font-medium text-slate-700">Enter cash counted in drawer:</Text>
            <TextInput
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-2xl font-bold text-slate-900"
              keyboardType="decimal-pad"
              value={closingCashText}
              onChangeText={setClosingCashText}
              placeholder="0"
            />
            {balanceHint ? (
              <View className="mt-3 rounded-lg bg-slate-50 p-3">
                <Text className={`text-base font-medium ${balanceHint.color}`}>{balanceHint.text}</Text>
                {balanceHint.status !== "BALANCED" ? (
                  <Text className="mt-1 text-xs text-slate-500">
                    Difference: RWF {Math.abs(variance).toLocaleString()} (
                    {balanceHint.status === "OVERAGE" ? "more than expected" : "less than expected"})
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="mb-6 rounded-xl bg-white p-4">
            <Text className="mb-2 font-medium text-slate-700">Closing notes (optional)</Text>
            <TextInput
              className="min-h-[80px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Any issues during shift? e.g. printer offline, price correction on Table 4"
            />
          </View>

          <Pressable
            disabled={busy || !closingCashText}
            onPress={() => void doClose(true)}
            className="mb-3 items-center rounded-xl bg-indigo-600 py-4"
          >
            <Text className="font-semibold text-white">Close Shift & Print Summary</Text>
          </Pressable>
          <Pressable
            disabled={busy || !closingCashText}
            onPress={() => void doClose(false)}
            className="mb-3 items-center rounded-xl border border-indigo-200 bg-white py-4"
          >
            <Text className="font-semibold text-indigo-600">Close Shift (No Print)</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => router.back()} className="mb-8 items-center py-3">
            <Text className="text-slate-500">Cancel</Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={openTablesModal != null} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full rounded-2xl bg-white p-6">
            <Text className="text-lg font-bold text-slate-900">Open tables remain</Text>
            <Text className="mt-2 text-slate-600">
              You still have {openTablesModal?.length ?? 0} open table(s):{" "}
              {openTablesModal?.join(", ")}. Close all tables before ending shift.
            </Text>
            <Pressable
              onPress={() => {
                setOpenTablesModal(null);
                router.push("/(main)/tables");
              }}
              className="mt-5 items-center rounded-xl bg-indigo-600 py-3"
            >
              <Text className="font-semibold text-white">Go to Tables</Text>
            </Pressable>
            <Pressable onPress={() => setOpenTablesModal(null)} className="mt-2 items-center py-2">
              <Text className="text-slate-500">Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PrintShiftModal
        visible={printModal}
        summary={closedSummary}
        busy={busy}
        onPrint={async () => {
          if (!closedSummary) return;
          setBusy(true);
          try {
            await printShiftSummary(closedSummary, closedSummary.depotName || "Hotel");
          } catch {
            Toast.show({ type: "info", text1: "Print simulated", text2: "Check console in Expo Go" });
          } finally {
            setBusy(false);
          }
        }}
        onDone={() => {
          setPrintModal(false);
          router.replace("/(main)/outlets");
        }}
      />
    </View>
  );
}
