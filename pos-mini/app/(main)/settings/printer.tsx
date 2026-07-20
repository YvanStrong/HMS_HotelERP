import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { getPrinterSettings, getKitchenPrinterRoutes, saveKitchenPrinterRoutes, savePrinterSettings } from '../../../src/repositories/metaRepository';
import { listCategories } from '../../../src/repositories/categoryRepository';
import type { Category } from '../../../src/types';
import {
  clearPrinterAddress,
  connectPrinter,
  isPrinterModuleAvailable,
  savedPrinterAddress,
  savedPrinterName,
  scanForPrinters,
  testPrint,
  type PrinterDevice,
} from '../../../src/printing/PrinterService';
import { useThemeColors } from '../../../src/hooks/useTheme';

export default function PrinterSettingsScreen() {
  const colors = useThemeColors();
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kitchenRoutes, setKitchenRoutes] = useState<Awaited<ReturnType<typeof getKitchenPrinterRoutes>>>([]);
  const nativeAvailable = isPrinterModuleAvailable();

  const loadSaved = useCallback(async () => {
    const [address, name, printerSettings, cats, routes] = await Promise.all([
      savedPrinterAddress(),
      savedPrinterName(),
      getPrinterSettings(),
      listCategories(),
      getKitchenPrinterRoutes(),
    ]);
    setConnectedAddress(address);
    setConnectedName(name);
    setAutoPrint(printerSettings.autoPrint);
    setCategories(cats);
    setKitchenRoutes(routes);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved]),
  );

  const toggleAutoPrint = async (value: boolean) => {
    setAutoPrint(value);
    await savePrinterSettings({ autoPrint: value });
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const list = await scanForPrinters();
      setDevices(list);
      if (list.length === 0) {
        Toast.show({ type: 'info', text1: nativeAvailable ? 'No printers found' : 'Simulation mode' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Scan failed' });
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (device: PrinterDevice) => {
    setConnecting(device.address);
    try {
      await connectPrinter(device);
      await loadSaved();
      Toast.show({ type: 'success', text1: 'Printer connected', text2: device.name });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Connect failed' });
    } finally {
      setConnecting(null);
    }
  };

  const handleTestPrint = async () => {
    setPrinting(true);
    try {
      const result = await testPrint();
      Toast.show({ type: 'success', text1: result.simulated ? 'Test print simulated' : 'Test print sent' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Print failed' });
    } finally {
      setPrinting(false);
    }
  };

  const handleDisconnect = async () => {
    await clearPrinterAddress();
    await loadSaved();
    Toast.show({ type: 'success', text1: 'Printer disconnected' });
  };

  const assignKitchenRoute = async (category: Category) => {
    if (!connectedAddress) {
      Toast.show({ type: 'error', text1: 'Connect a printer first' });
      return;
    }
    const next = kitchenRoutes.filter((r) => r.categoryId !== category.id);
    next.push({
      categoryId: category.id,
      categoryName: category.name,
      printerAddress: connectedAddress,
      printerName: connectedName ?? undefined,
    });
    await saveKitchenPrinterRoutes(next);
    setKitchenRoutes(next);
    Toast.show({ type: 'success', text1: `${category.name} → kitchen printer` });
  };

  return (
    <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <Text className="mb-4 text-xl font-bold text-app-text">Bluetooth Printer</Text>

      <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <View className="flex-1 pr-3">
          <Text className="font-semibold text-app-text">Auto-print after sale</Text>
          <Text className="text-xs text-app-muted">Print receipt when a sale completes</Text>
        </View>
        <Switch value={autoPrint} onValueChange={(v) => void toggleAutoPrint(v)} />
      </View>

      {!nativeAvailable ? (
        <View className="mb-4 border-2 border-app-border bg-app-surface p-4">
          <Text className="font-bold text-app-text">Expo Go mode</Text>
          <Text className="mt-1 text-sm text-gray-600">
            Bluetooth printing requires a custom dev build with react-native-thermal-receipt-printer-image-qr.
          </Text>
        </View>
      ) : null}

      <View className="mb-4 border-2 border-app-border bg-app-surface p-4">
        <Text className="font-bold text-app-text">Connected printer</Text>
        {connectedAddress ? (
          <>
            <Text className="mt-1 text-app-text">{connectedName ?? 'Printer'}</Text>
            <Text className="text-sm text-gray-600">{connectedAddress}</Text>
          </>
        ) : (
          <Text className="mt-1 text-gray-600">No printer configured</Text>
        )}
      </View>

      <Pressable onPress={() => void handleScan()} disabled={scanning} className="mb-3 border-2 border-app-border bg-app-primary py-3">
        {scanning ? <ActivityIndicator color="#fff" /> : <Text className="text-center font-bold text-white">Scan for Printers</Text>}
      </Pressable>

      {devices.map((device) => (
        <Pressable key={device.address} onPress={() => void handleConnect(device)} disabled={connecting === device.address} className="mb-2 border-2 border-app-border bg-app-surface p-3">
          <Text className="font-bold text-app-text">{device.name}</Text>
          <Text className="text-sm text-gray-600">{device.address}</Text>
        </Pressable>
      ))}

      {connectedAddress ? (
        <>
          <Pressable onPress={() => void handleTestPrint()} disabled={printing} className="mb-3 mt-2 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-bold text-white">{printing ? 'Printing...' : 'Test Print'}</Text>
          </Pressable>
          <Pressable onPress={() => void handleDisconnect()} className="border-2 border-app-border bg-app-surface py-3">
            <Text className="text-center font-bold text-app-text">Disconnect</Text>
          </Pressable>
        </>
      ) : null}

      {categories.length > 0 ? (
        <View className="mb-4 mt-4 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="mb-1 font-bold text-app-text">Kitchen printer routing</Text>
          <Text className="mb-3 text-xs text-app-muted">
            Assign the connected printer to a category. Kitchen tickets for that category print there; others use the default printer.
          </Text>
          {categories.map((cat) => {
            const route = kitchenRoutes.find((r) => r.categoryId === cat.id);
            return (
              <Pressable
                key={cat.id}
                onPress={() => void assignKitchenRoute(cat)}
                className="mb-2 flex-row items-center justify-between rounded-lg border border-app-border px-3 py-2"
              >
                <Text className="font-medium text-app-text">{cat.name}</Text>
                <Text className="text-xs text-app-muted">{route?.printerName ?? route?.printerAddress ?? 'Default'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </KeyboardFormScroll>
  );
}
