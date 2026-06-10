import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PosShiftSummaryDTO } from "../api/shifts";
import { money } from "../api/shifts";
import { cashVarianceStatus, computeExpectedCash, roundMoney } from "../lib/cashReconciliation";

type Props = {
  visible: boolean;
  summary: PosShiftSummaryDTO | null;
  busy: boolean;
  onPrint: () => void;
  onDone: () => void;
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

export function PrintShiftModal({ visible, summary, busy, onPrint, onDone }: Props) {
  if (!summary) return null;

  const expected =
    summary.expectedCash != null
      ? money(summary.expectedCash)
      : computeExpectedCash(summary.openingFloat, summary.totalCash);
  const variance = roundMoney(money(summary.cashVariance));
  const status = summary.cashVarianceStatus ?? cashVarianceStatus(variance);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <View className="items-center">
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text className="mt-3 text-xl font-bold text-slate-900">Shift Closed Successfully</Text>
            <Text className="mt-2 text-2xl font-bold text-indigo-600">
              RWF {money(summary.totalRevenue).toLocaleString()}
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              Duration: {formatDuration(summary.durationMinutes)}
            </Text>
          </View>

          <View className="mt-4 rounded-xl bg-slate-50 p-3">
            <Text className="text-xs font-medium uppercase text-slate-500">Cash reconciliation</Text>
            <Text className="mt-1 text-sm text-slate-700">
              Opening RWF {money(summary.openingFloat).toLocaleString()} + Cash sales RWF{" "}
              {money(summary.totalCash).toLocaleString()}
            </Text>
            <Text className="text-sm font-semibold text-slate-900">
              Expected RWF {expected.toLocaleString()} · Counted RWF{" "}
              {money(summary.closingCash).toLocaleString()}
            </Text>
            <Text
              className={`mt-1 text-sm font-medium ${
                status === "BALANCED" ? "text-emerald-600" : status === "OVERAGE" ? "text-amber-600" : "text-red-600"
              }`}
            >
              {status === "BALANCED"
                ? "✅ Balanced"
                : status === "OVERAGE"
                  ? `⚠️ Overage RWF +${Math.abs(variance).toLocaleString()}`
                  : `❌ Shortage RWF ${Math.abs(variance).toLocaleString()}`}
            </Text>
          </View>

          <Pressable
            disabled={busy}
            onPress={onPrint}
            className="mt-6 items-center rounded-xl bg-indigo-600 py-4"
          >
            <Text className="font-semibold text-white">{busy ? "Printing…" : "Print Shift Summary"}</Text>
          </Pressable>

          <Pressable disabled={busy} onPress={onDone} className="mt-3 items-center rounded-xl border border-slate-200 py-3">
            <Text className="font-medium text-slate-700">Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
