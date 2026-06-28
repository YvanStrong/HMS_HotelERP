import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { setAppLanguage, type AppLanguage } from "../../src/i18n";
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

const ROLE_KEYS: Record<PrinterRole, { title: string; hint: string }> = {
  receipt: { title: "receiptPrinter", hint: "receiptPrinterHint" },
  kitchen: { title: "kitchenPrinter", hint: "kitchenPrinterHint" },
  bar: { title: "barPrinter", hint: "barPrinterHint" },
};

function detectInitialLang(i18nLang: string): AppLanguage {
  const saved = mmkvGetString("app_language");
  if (saved === "en" || saved === "fr" || saved === "rw") return saved;
  if (i18nLang.startsWith("fr")) return "fr";
  if (i18nLang.startsWith("rw")) return "rw";
  return "en";
}

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
  const { t } = useTranslation();
  const connected = getPrinter(role);
  const { title, hint } = ROLE_KEYS[role];
  const scanning = scanningRole === role;

  return (
    <View className="mb-6 rounded-xl bg-white p-4">
      <Text className="text-base font-bold text-slate-900">{t(title)}</Text>
      <Text className="mt-0.5 text-xs text-slate-500">{t(hint)}</Text>
      <Text className="mt-2 text-sm text-slate-600">
        {connected ? `${connected.name} · ${connected.address}` : t("notConfigured")}
      </Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => onScan(role)}
          disabled={scanning || busy}
          className="rounded-lg bg-indigo-600 px-3 py-2"
        >
          <Text className="text-sm font-medium text-white">{scanning ? t("scanning") : t("scan")}</Text>
        </Pressable>

        {connected ? (
          <>
            <Pressable
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void testPrintForRole(role)
                  .then(() => Toast.show({ type: "success", text1: t("testPrintSent") }))
                  .catch((e) => Toast.show({ type: "error", text1: t("printFailed"), text2: String(e) }))
                  .finally(() => setBusy(false));
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <Text className="text-sm font-medium text-slate-700">{t("test")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                clearPrinter(role);
                Toast.show({ type: "info", text1: t("printerRemoved") });
              }}
              className="rounded-lg px-3 py-2"
            >
              <Text className="text-sm text-red-600">{t("remove")}</Text>
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
                  .then(() => Toast.show({ type: "success", text1: t("connected"), text2: d.name }))
                  .catch((e) => Toast.show({ type: "error", text1: t("failed"), text2: String(e) }))
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

const LANG_OPTIONS: { code: AppLanguage; labelKey: "english" | "french" | "kinyarwanda" }[] = [
  { code: "en", labelKey: "english" },
  { code: "fr", labelKey: "french" },
  { code: "rw", labelKey: "kinyarwanda" },
];

export default function PrinterSettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [lang, setLang] = useState<AppLanguage>(() => detectInitialLang(i18n.language));
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
        text1: t("devBuildRequired"),
        text2: t("devBuildHint"),
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
      Toast.show({ type: "error", text1: t("noReceiptPrinter") });
      return;
    }
    setBusy(true);
    try {
      await printReceipt(
        closedSummaryToTicketDetail(lastReceipt),
        lastReceipt.depotName || hotelName,
      );
      Toast.show({ type: "success", text1: t("receiptReprinted") });
    } catch (e) {
      Toast.show({ type: "error", text1: t("printFailed"), text2: String(e) });
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
      Toast.show({ type: "error", text1: t("enterCategoryKeyword") });
      return;
    }
    setBarCategories(parts);
    setBarCategoriesText(parts.join(", "));
    Toast.show({ type: "success", text1: t("barCategoriesSaved") });
  }

  const printers = getAllPrinters();
  void printers;
  void refresh;

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>
        <Pressable onPress={() => router.back()}>
          <Text className="text-indigo-600">{t("back")}</Text>
        </Pressable>
        <Text className="mt-2 text-xl font-bold text-slate-900">{t("printerSettings")}</Text>
        <Text className="text-sm text-slate-500">{t("printerSettingsHint")}</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {lastReceipt ? (
          <View className="mb-6 rounded-xl bg-white p-4">
            <Text className="text-base font-bold text-slate-900">{t("reprintLastReceipt")}</Text>
            <Text className="mt-1 text-sm text-slate-600">
              {t("lastReceiptSummary", {
                table: lastReceipt.tableLabel,
                amount: money(lastReceipt.totalAmount).toFixed(0),
                time: new Date(lastReceipt.closedAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </Text>
            <Pressable
              disabled={busy}
              onPress={() => void handleReprintLast()}
              className="mt-3 self-start rounded-lg bg-indigo-600 px-4 py-2"
            >
              <Text className="text-sm font-medium text-white">{t("reprintLastReceiptBtn")}</Text>
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
          <Text className="text-base font-bold text-slate-900">{t("barCategoryKeywords")}</Text>
          <Text className="mt-0.5 text-xs text-slate-500">{t("barCategoryHint")}</Text>
          <TextInput
            className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            value={barCategoriesText}
            onChangeText={setBarCategoriesText}
            placeholder="Bar, Drinks, Beverages, …"
            autoCapitalize="words"
          />
          <Pressable onPress={saveBarCategories} className="mt-3 self-start rounded-lg bg-indigo-600 px-4 py-2">
            <Text className="text-sm font-medium text-white">{t("saveKeywords")}</Text>
          </Pressable>
          {depotCategories.length > 0 ? (
            <View className="mt-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("categoriesInOutlet", { outlet: depot?.name ?? t("outlet") })}
              </Text>
              <Text className="mt-1 text-xs text-slate-600">{depotCategories.join(" · ")}</Text>
            </View>
          ) : null}
        </View>

        <View className="mb-6 rounded-xl bg-white p-4">
          <Text allowFontScaling={false} className="text-base font-bold text-slate-900">
            {t("pinSettings")}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500">{t("pinSettingsHint")}</Text>
          <Pressable
            onPress={() => router.push("/(main)/pin-settings")}
            className="mt-3 self-start rounded-lg bg-indigo-600 px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">{t("managePin")}</Text>
          </Pressable>
        </View>

        <View className="mb-6 rounded-xl bg-white p-4">
          <Text allowFontScaling={false} className="text-base font-bold text-slate-900">
            {t("language")}
          </Text>
          <View className="mt-3 flex-row gap-2">
            {LANG_OPTIONS.map(({ code, labelKey }) => (
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
                  {t(labelKey)}
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
