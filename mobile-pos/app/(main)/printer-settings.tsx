import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { setAppLanguage } from "../../src/i18n";
import { mmkvGetString } from "../../src/storage/mmkv";
import { useQuery } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { fetchDepotProducts } from "../../src/api/depots";
import { useHeaderPadding } from "../../src/hooks/useScreenInsets";
import {
  clearPrinter,
  getAllPrinters,
  getBarCategoriesText,
  getPrinter,
  setBarCategories,
  type PrinterRole,
} from "../../src/printing/PrinterConfig";
import {
  connectPrinterForRole,
  isPrinterModuleAvailable,
  printReceipt,
  scanForPrinters,
  testPrintForRole,
  type PrinterDevice,
} from "../../src/printing/PrinterService";
import {
  closedSummaryToTicketDetail,
  loadLastClosedTicket,
  type ClosedTicketSummary,
} from "../../src/storage/lastReceipt";
import { money } from "../../src/api/tickets";
import { useAuthStore } from "../../src/store/authStore";
import { useCartStore } from "../../src/store/cartStore";

const ROLE_LABELS: Record<PrinterRole, { title: string; hint: string }> = {
  receipt: { title: "Receipt printer", hint: "Customer receipt after payment" },
  kitchen: { title: "Kitchen printer", hint: "Auto-print when sent to kitchen" },
  bar: { title: "Bar printer", hint: "Bar / beverage items only" },
};

function PrinterRoleSection({
  role,
  onScan,
  scanningRole,
  devices,
  busy,
  setBusy,
}: {
  role: PrinterRole;
  onScan: (role: PrinterRole) => void;
  scanningRole: PrinterRole | null;
  devices: PrinterDevice[];
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const connected = getPrinter(role);
  const { title, hint } = ROLE_LABELS[role];
  const scanning = scanningRole === role;

  return (
    <View className="mb-6 rounded-xl bg-white p-4">
      <Text className="text-base font-bold text-slate-900">{title}</Text>
      <Text className="mt-0.5 text-xs text-slate-500">{hint}</Text>
      <Text className="mt-2 text-sm text-slate-600">
        {connected ? `${connected.name} · ${connected.address}` : "Not configured"}
      </Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => onScan(role)}
          disabled={scanning || busy}
          className="rounded-lg bg-indigo-600 px-3 py-2"
        >
          <Text className="text-sm font-medium text-white">{scanning ? "Scanning…" : "Scan"}</Text>
        </Pressable>

        {connected ? (
          <>
            <Pressable
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void testPrintForRole(role)
                  .then(() => Toast.show({ type: "success", text1: "Test print sent" }))
                  .catch((e) => Toast.show({ type: "error", text1: "Print failed", text2: String(e) }))
                  .finally(() => setBusy(false));
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <Text className="text-sm font-medium text-slate-700">Test</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                clearPrinter(role);
                Toast.show({ type: "info", text1: "Printer removed" });
              }}
              className="rounded-lg px-3 py-2"
            >
              <Text className="text-sm text-red-600">Remove</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {scanningRole === role && devices.length > 0 ? (
        <View className="mt-3">
          {devices.map((d) => (
            <Pressable
              key={`${role}-${d.address}`}
              className="mb-2 rounded-lg border border-slate-200 p-3"
              onPress={() => {
                setBusy(true);
                void connectPrinterForRole(role, d)
                  .then(() => Toast.show({ type: "success", text1: "Connected", text2: d.name }))
                  .catch((e) => Toast.show({ type: "error", text1: "Failed", text2: String(e) }))
                  .finally(() => setBusy(false));
              }}
            >
              <Text className="font-medium">{d.name}</Text>
              <Text className="text-xs text-slate-500">{d.address}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function PrinterSettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "fr">(
    (mmkvGetString("app_language") as "en" | "fr") || (i18n.language.startsWith("fr") ? "fr" : "en"),
  );
  const headerPad = useHeaderPadding();
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const hotelName = useAuthStore((s) => s.user?.username) ?? "Hotel";
  const depot = useCartStore((s) => s.selectedDepot);
  const [scanningRole, setScanningRole] = useState<PrinterRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [barCategoriesText, setBarCategoriesText] = useState(getBarCategoriesText);
  const [lastReceipt, setLastReceipt] = useState<ClosedTicketSummary | null>(() => loadLastClosedTicket());
  const [, tick] = useState(0);
  const refresh = useCallback(() => {
    setLastReceipt(loadLastClosedTicket());
    tick((n) => n + 1);
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["depot-products", hotelId, depot?.id],
    queryFn: () => fetchDepotProducts(hotelId, depot!.id),
    enabled: !!hotelId && !!depot?.id,
  });

  const depotCategories = useMemo(() => {
    const names = new Set(products.map((p) => p.menuName).filter(Boolean));
    return [...names].sort();
  }, [products]);

  async function handleScan(role: PrinterRole) {
    if (!isPrinterModuleAvailable()) {
      Toast.show({
        type: "info",
        text1: "Dev build required",
        text2: "Install a dev build with the printer native module",
      });
      return;
    }
    setScanningRole(role);
    setDevices([]);
    try {
      setDevices(await scanForPrinters());
    } finally {
      setScanningRole(null);
    }
  }

  async function handleReprintLast() {
    if (!lastReceipt) return;
    if (!getPrinter("receipt")) {
      Toast.show({ type: "error", text1: "No receipt printer configured" });
      return;
    }
    setBusy(true);
    try {
      await printReceipt(
        closedSummaryToTicketDetail(lastReceipt),
        lastReceipt.depotName || hotelName,
      );
      Toast.show({ type: "success", text1: "Receipt reprinted" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Print failed", text2: String(e) });
    } finally {
      setBusy(false);
    }
  }

  function saveBarCategories() {
    const parts = barCategoriesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      Toast.show({ type: "error", text1: "Enter at least one category keyword" });
      return;
    }
    setBarCategories(parts);
    setBarCategoriesText(parts.join(", "));
    Toast.show({ type: "success", text1: "Bar categories saved" });
  }

  const printers = getAllPrinters();
  void printers;
  void refresh;

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>
        <Pressable onPress={() => router.back()}>
          <Text className="text-indigo-600">← Back</Text>
        </Pressable>
        <Text className="mt-2 text-xl font-bold text-slate-900">Printer settings</Text>
        <Text className="text-sm text-slate-500">Assign receipt, kitchen, and bar printers</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {lastReceipt ? (
          <View className="mb-6 rounded-xl bg-white p-4">
            <Text className="text-base font-bold text-slate-900">Reprint last receipt</Text>
            <Text className="mt-1 text-sm text-slate-600">
              Last: Table {lastReceipt.tableLabel} — RWF {money(lastReceipt.totalAmount).toFixed(0)} at{" "}
              {new Date(lastReceipt.closedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Pressable
              disabled={busy}
              onPress={() => void handleReprintLast()}
              className="mt-3 self-start rounded-lg bg-indigo-600 px-4 py-2"
            >
              <Text className="text-sm font-medium text-white">Reprint Last Receipt</Text>
            </Pressable>
          </View>
        ) : null}

        {(["receipt", "kitchen", "bar"] as PrinterRole[]).map((role) => (
          <PrinterRoleSection
            key={role}
            role={role}
            onScan={handleScan}
            scanningRole={scanningRole}
            devices={devices}
            busy={busy}
            setBusy={setBusy}
          />
        ))}

        <View className="mb-6 rounded-xl bg-white p-4">
          <Text className="text-base font-bold text-slate-900">Bar category keywords</Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            Comma-separated menu category names routed to the bar printer
          </Text>
          <TextInput
            className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            value={barCategoriesText}
            onChangeText={setBarCategoriesText}
            placeholder="Bar, Drinks, Beverages, …"
            autoCapitalize="words"
          />
          <Pressable onPress={saveBarCategories} className="mt-3 self-start rounded-lg bg-indigo-600 px-4 py-2">
            <Text className="text-sm font-medium text-white">Save keywords</Text>
          </Pressable>
          {depotCategories.length > 0 ? (
            <View className="mt-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Categories in {depot?.name ?? "outlet"}
              </Text>
              <Text className="mt-1 text-xs text-slate-600">{depotCategories.join(" · ")}</Text>
            </View>
          ) : null}
        </View>

        <View className="mb-6 rounded-xl bg-white p-4">
          <Text allowFontScaling={false} className="text-base font-bold text-slate-900">
            {t("language")}
          </Text>
          <View className="mt-3 flex-row gap-2">
            {(["en", "fr"] as const).map((code) => (
              <Pressable
                key={code}
                onPress={() => {
                  setLang(code);
                  setAppLanguage(code);
                }}
                className={`min-h-[44px] flex-1 items-center justify-center rounded-xl ${
                  lang === code ? "bg-indigo-600" : "bg-slate-100"
                }`}
              >
                <Text allowFontScaling={false} className={lang === code ? "font-semibold text-white" : "text-slate-700"}>
                  {code === "en" ? t("english") : t("french")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {busy ? (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : null}
    </View>
  );
}
