import { useQuery } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import {
  fetchAnalyticsExportCsv,
  fetchAnalyticsSummary,
  fetchAnalyticsTopItems,
  fetchAnalyticsWaiters,
  fetchEndOfDayReport,
  fmtRwf,
  type EndOfDayReport,
} from "../../src/api/manager";
import { fetchDepots } from "../../src/api/depots";
import { fetchPosTables, fetchTicket } from "../../src/api/tickets";
import { useAuthStore } from "../../src/store/authStore";
import { useHeaderPadding } from "../../src/hooks/useScreenInsets";
import { getPrinter } from "../../src/printing/PrinterConfig";
import { printReceipt } from "../../src/printing/PrinterService";
import { shareCsvFile, sharePlainText } from "../../src/lib/shareReport";

const MANAGER_ROLES = new Set(["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"]);

type Tab = "analytics" | "eod";
type RangePreset = "today" | "yesterday" | "week" | "month" | "custom";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: RangePreset): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") {
    const s = toIsoDate(today);
    return { from: s, to: s };
  }
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = toIsoDate(y);
    return { from: s, to: s };
  }
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: toIsoDate(start), to: toIsoDate(today) };
  }
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toIsoDate(start), to: toIsoDate(today) };
  }
  return { from: toIsoDate(today), to: toIsoDate(today) };
}

function varianceColor(status: string): string {
  if (status === "BALANCED") return "text-emerald-600";
  if (status === "OVERAGE" || status === "HAS_OVERAGES") return "text-orange-600";
  return "text-red-600";
}

export default function ManagerScreen() {
  const router = useRouter();
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const headerPad = useHeaderPadding();
  const role = useAuthStore((s) => s.user?.role?.toUpperCase() ?? "");

  const [tab, setTab] = useState<Tab>("analytics");
  const [rangePreset, setRangePreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState(new Date());
  const [customTo, setCustomTo] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [eodDate, setEodDate] = useState(new Date());
  const [showEodPicker, setShowEodPicker] = useState(false);
  const [eodReport, setEodReport] = useState<EndOfDayReport | null>(null);
  const [eodLoading, setEodLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [reprintBusy, setReprintBusy] = useState<string | null>(null);

  const range = useMemo(() => {
    if (rangePreset !== "custom") return rangeForPreset(rangePreset);
    return { from: toIsoDate(customFrom), to: toIsoDate(customTo) };
  }, [rangePreset, customFrom, customTo]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["pos-analytics", hotelId, range.from, range.to],
    queryFn: () => fetchAnalyticsSummary(hotelId, range.from, range.to),
    enabled: !!hotelId && MANAGER_ROLES.has(role) && tab === "analytics",
  });

  const { data: topItems = [] } = useQuery({
    queryKey: ["pos-top-items", hotelId, range.from, range.to],
    queryFn: () => fetchAnalyticsTopItems(hotelId, range.from, range.to, 5),
    enabled: !!hotelId && MANAGER_ROLES.has(role) && tab === "analytics",
  });

  const { data: waiters = [] } = useQuery({
    queryKey: ["pos-waiters", hotelId, range.from, range.to],
    queryFn: () => fetchAnalyticsWaiters(hotelId, range.from, range.to),
    enabled: !!hotelId && MANAGER_ROLES.has(role) && tab === "analytics",
  });

  const { data: depots = [] } = useQuery({
    queryKey: ["depots", hotelId],
    queryFn: () => fetchDepots(hotelId),
    enabled: !!hotelId && MANAGER_ROLES.has(role),
  });

  const { data: allTables = [] } = useQuery({
    queryKey: ["manager-tables", hotelId, depots.map((d) => d.id).join(",")],
    queryFn: async () => {
      const rows = await Promise.all(depots.map((d) => fetchPosTables(hotelId, d.id)));
      return depots.flatMap((d, i) => rows[i].map((t) => ({ ...t, depotName: d.name, depotId: d.id })));
    },
    enabled: !!hotelId && depots.length > 0 && MANAGER_ROLES.has(role),
    refetchInterval: 10_000,
  });

  async function generateEod() {
    setEodLoading(true);
    try {
      const report = await fetchEndOfDayReport(hotelId, toIsoDate(eodDate));
      setEodReport(report);
    } catch (e) {
      Toast.show({ type: "error", text1: "Report failed", text2: String(e) });
    } finally {
      setEodLoading(false);
    }
  }

  async function shareEod(report: EndOfDayReport) {
    const lines = [
      `End of Day — ${report.date}`,
      `Total Revenue: ${fmtRwf(report.totalRevenue)}`,
      `Cash: ${fmtRwf(report.totalCash)} | Card: ${fmtRwf(report.totalCard)} | Room: ${fmtRwf(report.totalRoomCharge)}`,
      `Tips: ${fmtRwf(report.totalTips)}`,
      `Expected in drawers: ${fmtRwf(report.expectedCashInDrawers)}`,
      `Variance: ${fmtRwf(report.totalCashVariance)} (${report.cashVarianceStatus})`,
      `Discounts: ${fmtRwf(report.totalDiscounts)} | Voids: ${report.totalVoids}`,
      "",
      ...report.perShift.map(
        (s) =>
          `${s.waiterName} @ ${s.depotName}: Cash ${fmtRwf(s.totalCash)}, variance ${fmtRwf(s.cashVariance)}, ${s.orderCount} orders`,
      ),
    ];
    await sharePlainText("End of Day Report", lines.join("\n"));
  }

  async function exportAnalytics() {
    setExportBusy(true);
    try {
      const csv = await fetchAnalyticsExportCsv(hotelId, range.from, range.to);
      await shareCsvFile(`pos-analytics-${range.from}-${range.to}.csv`, csv);
    } catch (e) {
      Toast.show({ type: "error", text1: "Export failed", text2: String(e) });
    } finally {
      setExportBusy(false);
    }
  }

  async function handleReprint(ticketId: string, depotName: string) {
    if (!getPrinter("receipt")) {
      Toast.show({ type: "error", text1: "No receipt printer configured" });
      return;
    }
    setReprintBusy(ticketId);
    try {
      const ticket = await fetchTicket(hotelId, ticketId);
      await printReceipt(ticket, depotName);
      Toast.show({ type: "success", text1: "Receipt sent to printer" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Reprint failed", text2: String(e) });
    } finally {
      setReprintBusy(null);
    }
  }

  if (!MANAGER_ROLES.has(role)) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-center text-slate-600">Manager dashboard is for hotel admin only.</Text>
      </View>
    );
  }

  const presets: { id: RangePreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>
        <Text className="text-xl font-bold text-slate-900">Manager</Text>
        <Text className="text-sm text-slate-500">Live floor, analytics & end of day</Text>
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => setTab("analytics")}
            className={`flex-1 rounded-xl py-2 ${tab === "analytics" ? "bg-indigo-600" : "bg-slate-100"}`}
          >
            <Text className={`text-center font-semibold ${tab === "analytics" ? "text-white" : "text-slate-600"}`}>
              Analytics
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("eod")}
            className={`flex-1 rounded-xl py-2 ${tab === "eod" ? "bg-indigo-600" : "bg-slate-100"}`}
          >
            <Text className={`text-center font-semibold ${tab === "eod" ? "text-white" : "text-slate-600"}`}>
              End of Day
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4 py-4">
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Live floor</Text>
        <View className="mb-6 flex-row flex-wrap gap-2">
          {allTables.map((t) => (
            <View key={`${t.depotId}-${t.id}`} className="min-w-[88px]">
              <Pressable
                onPress={() => {
                  if (t.activeTicketId) router.push(`/(main)/ticket/${t.activeTicketId}`);
                }}
                className={`rounded-xl border px-3 py-2 ${
                  t.occupied ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <Text className="text-center text-xs font-bold">{t.tableLabel}</Text>
                <Text className="text-center text-[10px] text-slate-500">{t.depotName}</Text>
              </Pressable>
              {t.occupied && t.activeTicketId ? (
                <Pressable
                  disabled={reprintBusy === t.activeTicketId}
                  onPress={() => void handleReprint(t.activeTicketId!, t.depotName)}
                  className="mt-1 rounded-lg bg-white px-2 py-1"
                >
                  <Text className="text-center text-[10px] font-semibold text-indigo-600">
                    {reprintBusy === t.activeTicketId ? "…" : "Reprint"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {tab === "analytics" ? (
          <>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {presets.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setRangePreset(p.id)}
                  className={`rounded-lg px-3 py-2 ${rangePreset === p.id ? "bg-indigo-600" : "bg-white border border-slate-200"}`}
                >
                  <Text className={`text-xs font-semibold ${rangePreset === p.id ? "text-white" : "text-slate-600"}`}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {rangePreset === "custom" ? (
              <View className="mb-4 flex-row gap-2">
                <Pressable onPress={() => setShowFromPicker(true)} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Text className="text-xs text-slate-500">From</Text>
                  <Text className="font-semibold">{toIsoDate(customFrom)}</Text>
                </Pressable>
                <Pressable onPress={() => setShowToPicker(true)} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Text className="text-xs text-slate-500">To</Text>
                  <Text className="font-semibold">{toIsoDate(customTo)}</Text>
                </Pressable>
              </View>
            ) : null}
            {showFromPicker ? (
              <DateTimePicker
                value={customFrom}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => {
                  setShowFromPicker(Platform.OS === "ios");
                  if (d) setCustomFrom(d);
                }}
              />
            ) : null}
            {showToPicker ? (
              <DateTimePicker
                value={customTo}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => {
                  setShowToPicker(Platform.OS === "ios");
                  if (d) setCustomTo(d);
                }}
              />
            ) : null}

            {analyticsLoading ? (
              <ActivityIndicator color="#4f46e5" />
            ) : analytics ? (
              <View className="mb-4 rounded-2xl bg-white p-4">
                <Text className="text-xs text-slate-500">
                  {range.from === range.to ? range.from : `${range.from} → ${range.to}`}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {[
                    { label: "Revenue", value: fmtRwf(analytics.totalRevenue) },
                    { label: "Orders", value: String(analytics.totalOrders) },
                    { label: "Covers", value: String(analytics.totalCovers) },
                    { label: "Avg ticket", value: fmtRwf(analytics.avgTicketValue) },
                  ].map((k) => (
                    <View key={k.label} className="min-w-[46%] flex-1 rounded-xl bg-slate-50 p-3">
                      <Text className="text-xs text-slate-500">{k.label}</Text>
                      <Text className="text-lg font-bold text-indigo-600">{k.value}</Text>
                    </View>
                  ))}
                </View>
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">By outlet</Text>
                {analytics.revenueByDepot.map((d) => (
                  <Text key={d.depotName} className="mt-1 text-sm text-slate-700">
                    {d.depotName}: {fmtRwf(d.revenue)} ({d.orders})
                  </Text>
                ))}
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">Top items</Text>
                {topItems.map((item) => (
                  <Text key={item.productName} className="text-sm text-slate-600">
                    {item.productName} ×{item.qtySold} · {fmtRwf(item.revenue)}
                  </Text>
                ))}
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">Waiters</Text>
                {waiters.map((w) => (
                  <View key={w.waiterName} className="flex-row justify-between border-b border-slate-100 py-2">
                    <Text className="text-sm text-slate-700">{w.waiterName}</Text>
                    <Text className="text-sm font-medium text-slate-900">
                      {w.ordersCount} · {fmtRwf(w.revenue)}
                    </Text>
                  </View>
                ))}
                <Pressable
                  disabled={exportBusy}
                  onPress={() => void exportAnalytics()}
                  className="mt-4 items-center rounded-xl border border-indigo-200 py-3"
                >
                  <Text className="font-semibold text-indigo-600">{exportBusy ? "Exporting…" : "Export CSV"}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setShowEodPicker(true)}
              className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <Text className="text-xs text-slate-500">Report date</Text>
              <Text className="text-lg font-semibold text-slate-900">{toIsoDate(eodDate)}</Text>
            </Pressable>
            {showEodPicker ? (
              <DateTimePicker
                value={eodDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => {
                  setShowEodPicker(Platform.OS === "ios");
                  if (d) setEodDate(d);
                }}
              />
            ) : null}
            <Pressable
              disabled={eodLoading}
              onPress={() => void generateEod()}
              className="mb-4 items-center rounded-xl bg-indigo-600 py-3"
            >
              <Text className="font-semibold text-white">{eodLoading ? "Generating…" : "Generate Report"}</Text>
            </Pressable>
            {eodReport ? (
              <View className="rounded-2xl bg-white p-4">
                <Text className="mb-3 text-sm font-semibold text-slate-800">Revenue summary</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { label: "Revenue", v: eodReport.totalRevenue },
                    { label: "Cash", v: eodReport.totalCash },
                    { label: "Card", v: eodReport.totalCard },
                    { label: "Room", v: eodReport.totalRoomCharge },
                    { label: "Tips", v: eodReport.totalTips },
                  ].map((k) => (
                    <View key={k.label} className="min-w-[30%] flex-1 rounded-lg bg-slate-50 p-2">
                      <Text className="text-[10px] text-slate-500">{k.label}</Text>
                      <Text className="text-sm font-bold text-indigo-600">{fmtRwf(k.v)}</Text>
                    </View>
                  ))}
                </View>
                <Text className="mt-4 text-sm font-semibold text-slate-800">Cash position</Text>
                <Text className="text-sm text-slate-700">
                  Expected in drawers: {fmtRwf(eodReport.expectedCashInDrawers)}
                </Text>
                <Text className="text-sm text-slate-700">
                  Total variances: {fmtRwf(eodReport.totalCashVariance)}
                </Text>
                <Text
                  className={`mt-1 text-sm font-semibold ${
                    eodReport.cashVarianceStatus === "BALANCED" ? "text-emerald-600" : "text-orange-600"
                  }`}
                >
                  {eodReport.cashVarianceStatus === "BALANCED" ? "✅ All Balanced" : "⚠️ Issues Found"}
                </Text>
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">Shifts</Text>
                {eodReport.perShift.map((s) => (
                  <View key={s.shiftId} className="border-b border-slate-100 py-2">
                    <Text className="font-medium text-slate-800">
                      {s.waiterName} · {s.depotName}
                    </Text>
                    <Text className="text-sm text-slate-600">
                      Cash {fmtRwf(s.totalCash)} · {s.orderCount} orders ·{" "}
                      <Text className={varianceColor(s.varianceStatus)}>
                        Var {fmtRwf(s.cashVariance)}
                      </Text>
                    </Text>
                  </View>
                ))}
                <Text className="mt-4 text-sm text-slate-700">
                  Discounts: {fmtRwf(eodReport.totalDiscounts)} · Voids: {eodReport.totalVoids}
                </Text>
                <Pressable
                  onPress={() => void shareEod(eodReport)}
                  className="mt-4 items-center rounded-xl bg-emerald-600 py-3"
                >
                  <Text className="font-semibold text-white">Share Report</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
