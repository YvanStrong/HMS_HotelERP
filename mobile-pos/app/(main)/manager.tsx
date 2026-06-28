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
import { useTranslation } from "react-i18next";
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
  const { t: tr } = useTranslation();
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
      Toast.show({ type: "error", text1: tr("reportFailed"), text2: String(e) });
    } finally {
      setEodLoading(false);
    }
  }

  async function shareEod(report: EndOfDayReport) {
    const lines = [
      tr("eodLineDate", { date: report.date }),
      tr("eodLineRevenue", { amount: fmtRwf(report.totalRevenue) }),
      tr("eodLinePayments", {
        cash: fmtRwf(report.totalCash),
        card: fmtRwf(report.totalCard),
        room: fmtRwf(report.totalRoomCharge),
      }),
      tr("eodLineTips", { amount: fmtRwf(report.totalTips) }),
      tr("eodLineExpected", { amount: fmtRwf(report.expectedCashInDrawers) }),
      tr("eodLineVariance", {
        amount: fmtRwf(report.totalCashVariance),
        status: report.cashVarianceStatus,
      }),
      tr("eodLineDiscountsVoids", {
        discounts: fmtRwf(report.totalDiscounts),
        voids: String(report.totalVoids),
      }),
      "",
      ...report.perShift.map((s) =>
        tr("eodShiftLine", {
          waiter: s.waiterName,
          depot: s.depotName,
          cash: fmtRwf(s.totalCash),
          variance: fmtRwf(s.cashVariance),
          orders: String(s.orderCount),
        }),
      ),
    ];
    await sharePlainText(tr("eodReportTitle"), lines.join("\n"));
  }

  async function exportAnalytics() {
    setExportBusy(true);
    try {
      const csv = await fetchAnalyticsExportCsv(hotelId, range.from, range.to);
      await shareCsvFile(`pos-analytics-${range.from}-${range.to}.csv`, csv);
    } catch (e) {
      Toast.show({ type: "error", text1: tr("exportFailed"), text2: String(e) });
    } finally {
      setExportBusy(false);
    }
  }

  async function handleReprint(ticketId: string, depotName: string) {
    if (!getPrinter("receipt")) {
      Toast.show({ type: "error", text1: tr("noReceiptPrinter") });
      return;
    }
    setReprintBusy(ticketId);
    try {
      const ticket = await fetchTicket(hotelId, ticketId);
      await printReceipt(ticket, depotName);
      Toast.show({ type: "success", text1: tr("receiptSent") });
    } catch (e) {
      Toast.show({ type: "error", text1: tr("reprintFailed"), text2: String(e) });
    } finally {
      setReprintBusy(null);
    }
  }

  if (!MANAGER_ROLES.has(role)) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-center text-slate-600">{tr("managerOnly")}</Text>
      </View>
    );
  }

  const presets: { id: RangePreset; label: string }[] = [
    { id: "today", label: tr("today") },
    { id: "yesterday", label: tr("yesterday") },
    { id: "week", label: tr("thisWeek") },
    { id: "month", label: tr("thisMonth") },
    { id: "custom", label: tr("customRange") },
  ];

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>
        <Text className="text-xl font-bold text-slate-900">{tr("manager")}</Text>
        <Text className="text-sm text-slate-500">{tr("managerSubtitle")}</Text>
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => setTab("analytics")}
            className={`flex-1 rounded-xl py-2 ${tab === "analytics" ? "bg-indigo-600" : "bg-slate-100"}`}
          >
            <Text className={`text-center font-semibold ${tab === "analytics" ? "text-white" : "text-slate-600"}`}>
              {tr("analytics")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("eod")}
            className={`flex-1 rounded-xl py-2 ${tab === "eod" ? "bg-indigo-600" : "bg-slate-100"}`}
          >
            <Text className={`text-center font-semibold ${tab === "eod" ? "text-white" : "text-slate-600"}`}>
              {tr("endOfDay")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4 py-4">
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{tr("liveFloor")}</Text>
        <View className="mb-6 flex-row flex-wrap gap-2">
          {allTables.map((row) => (
            <View key={`${row.depotId}-${row.id}`} className="min-w-[88px]">
              <Pressable
                onPress={() => {
                  if (row.activeTicketId) router.push(`/(main)/ticket/${row.activeTicketId}`);
                }}
                className={`rounded-xl border px-3 py-2 ${
                  row.occupied ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <Text className="text-center text-xs font-bold">{row.tableLabel}</Text>
                <Text className="text-center text-[10px] text-slate-500">{row.depotName}</Text>
              </Pressable>
              {row.occupied && row.activeTicketId ? (
                <Pressable
                  disabled={reprintBusy === row.activeTicketId}
                  onPress={() => void handleReprint(row.activeTicketId!, row.depotName)}
                  className="mt-1 rounded-lg bg-white px-2 py-1"
                >
                  <Text className="text-center text-[10px] font-semibold text-indigo-600">
                    {reprintBusy === row.activeTicketId ? "…" : tr("reprint")}
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
                  <Text className="text-xs text-slate-500">{tr("from")}</Text>
                  <Text className="font-semibold">{toIsoDate(customFrom)}</Text>
                </Pressable>
                <Pressable onPress={() => setShowToPicker(true)} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Text className="text-xs text-slate-500">{tr("to")}</Text>
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
                    { label: tr("revenue"), value: fmtRwf(analytics.totalRevenue) },
                    { label: tr("orders"), value: String(analytics.totalOrders) },
                    { label: tr("covers"), value: String(analytics.totalCovers) },
                    { label: tr("avgTicket"), value: fmtRwf(analytics.avgTicketValue) },
                  ].map((k) => (
                    <View key={k.label} className="min-w-[46%] flex-1 rounded-xl bg-slate-50 p-3">
                      <Text className="text-xs text-slate-500">{k.label}</Text>
                      <Text className="text-lg font-bold text-indigo-600">{k.value}</Text>
                    </View>
                  ))}
                </View>
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">{tr("byOutlet")}</Text>
                {analytics.revenueByDepot.map((d) => (
                  <Text key={d.depotName} className="mt-1 text-sm text-slate-700">
                    {d.depotName}: {fmtRwf(d.revenue)} ({d.orders})
                  </Text>
                ))}
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">{tr("topItems")}</Text>
                {topItems.map((item) => (
                  <Text key={item.productName} className="text-sm text-slate-600">
                    {item.productName} ×{item.qtySold} · {fmtRwf(item.revenue)}
                  </Text>
                ))}
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">{tr("waiters")}</Text>
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
                  <Text className="font-semibold text-indigo-600">
                    {exportBusy ? tr("exporting") : tr("exportCsv")}
                  </Text>
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
              <Text className="text-xs text-slate-500">{tr("reportDate")}</Text>
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
              <Text className="font-semibold text-white">
                {eodLoading ? tr("generating") : tr("generateReport")}
              </Text>
            </Pressable>
            {eodReport ? (
              <View className="rounded-2xl bg-white p-4">
                <Text className="mb-3 text-sm font-semibold text-slate-800">{tr("revenueSummary")}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { label: tr("revenue"), v: eodReport.totalRevenue },
                    { label: tr("cash"), v: eodReport.totalCash },
                    { label: tr("card"), v: eodReport.totalCard },
                    { label: tr("roomCharges"), v: eodReport.totalRoomCharge },
                    { label: tr("tip"), v: eodReport.totalTips },
                  ].map((k) => (
                    <View key={k.label} className="min-w-[30%] flex-1 rounded-lg bg-slate-50 p-2">
                      <Text className="text-[10px] text-slate-500">{k.label}</Text>
                      <Text className="text-sm font-bold text-indigo-600">{fmtRwf(k.v)}</Text>
                    </View>
                  ))}
                </View>
                <Text className="mt-4 text-sm font-semibold text-slate-800">{tr("cashPosition")}</Text>
                <Text className="text-sm text-slate-700">
                  {tr("expectedDrawers")}: {fmtRwf(eodReport.expectedCashInDrawers)}
                </Text>
                <Text className="text-sm text-slate-700">
                  {tr("totalVariances")}: {fmtRwf(eodReport.totalCashVariance)}
                </Text>
                <Text
                  className={`mt-1 text-sm font-semibold ${
                    eodReport.cashVarianceStatus === "BALANCED" ? "text-emerald-600" : "text-orange-600"
                  }`}
                >
                  {eodReport.cashVarianceStatus === "BALANCED" ? tr("allBalanced") : tr("issuesFound")}
                </Text>
                <Text className="mt-4 text-xs font-bold uppercase text-slate-500">{tr("shifts")}</Text>
                {eodReport.perShift.map((s) => (
                  <View key={s.shiftId} className="border-b border-slate-100 py-2">
                    <Text className="font-medium text-slate-800">
                      {s.waiterName} · {s.depotName}
                    </Text>
                    <Text className="text-sm text-slate-600">
                      {tr("cashSalesLabel", { amount: fmtRwf(s.totalCash) })} ·{" "}
                      {tr("ordersCount", { count: String(s.orderCount) })} ·{" "}
                      <Text className={varianceColor(s.varianceStatus)}>
                        {tr("varianceLabel", { amount: fmtRwf(s.cashVariance) })}
                      </Text>
                    </Text>
                  </View>
                ))}
                <Text className="mt-4 text-sm text-slate-700">
                  {tr("discountsVoidsLine", {
                    discounts: fmtRwf(eodReport.totalDiscounts),
                    voids: String(eodReport.totalVoids),
                  })}
                </Text>
                <Pressable
                  onPress={() => void shareEod(eodReport)}
                  className="mt-4 items-center rounded-xl bg-emerald-600 py-3"
                >
                  <Text className="font-semibold text-white">{tr("shareReport")}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
