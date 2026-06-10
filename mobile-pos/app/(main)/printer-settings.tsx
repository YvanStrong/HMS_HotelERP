import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import {
  clearPrinter,
  getAllPrinters,
  getPrinter,
  type PrinterRole,
} from "../../src/printing/PrinterConfig";
import {
  connectPrinterForRole,
  isPrinterModuleAvailable,
  scanForPrinters,
  testPrintForRole,
  type PrinterDevice,
} from "../../src/printing/PrinterService";

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
  const router = useRouter();
  const [scanningRole, setScanningRole] = useState<PrinterRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [, tick] = useState(0);
  const refresh = useCallback(() => tick((n) => n + 1), []);

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

  const printers = getAllPrinters();
  void printers;
  void refresh;

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-12">
        <Pressable onPress={() => router.back()}>
          <Text className="text-indigo-600">← Back</Text>
        </Pressable>
        <Text className="mt-2 text-xl font-bold text-slate-900">Printer settings</Text>
        <Text className="text-sm text-slate-500">Assign receipt, kitchen, and bar printers</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
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
      </ScrollView>

      {busy ? (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : null}
    </View>
  );
}
