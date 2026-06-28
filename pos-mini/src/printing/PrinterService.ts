// Bluetooth printing requires a custom dev build with react-native-thermal-receipt-printer-image-qr.
// In Expo Go, printing is simulated (logs to console only).

import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { PermissionsAndroid, Platform } from 'react-native';
import { getProductById } from '../repositories/productRepository';
import type { BusinessSettings, Sale, SaleItem } from '../types';
import { buildReceiptText } from '../utils/receipt';
import { loadReceiptBuildOptions } from '../utils/receiptOptions';

const PRINTER_KEY = 'pos_mini_printer_address';
const PRINTER_NAME_KEY = 'pos_mini_printer_name';
const PRINT_TIMEOUT_MS = 5000;

export type PrinterDevice = {
  name: string;
  address: string;
};

type NativePrinter = {
  getDeviceList?: () => Promise<PrinterDevice[]>;
  connectPrinter?: (address: string) => Promise<void>;
  printText?: (text: string) => Promise<void>;
};

function loadNative(): NativePrinter | null {
  if (Constants.appOwnership === 'expo') {
    return null;
  }
  try {
    return require('react-native-thermal-receipt-printer-image-qr') as NativePrinter;
  } catch {
    console.warn('[PrinterService] Native module not available. Running in simulation mode.');
    return null;
  }
}

export function isPrinterModuleAvailable(): boolean {
  return loadNative() != null;
}

export async function savedPrinterAddress(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PRINTER_KEY);
  } catch {
    return null;
  }
}

export async function savedPrinterName(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PRINTER_NAME_KEY);
  } catch {
    return null;
  }
}

export async function savePrinterAddress(address: string, name?: string): Promise<void> {
  await SecureStore.setItemAsync(PRINTER_KEY, address);
  if (name) {
    await SecureStore.setItemAsync(PRINTER_NAME_KEY, name);
  }
}

export async function clearPrinterAddress(): Promise<void> {
  await SecureStore.deleteItemAsync(PRINTER_KEY);
  await SecureStore.deleteItemAsync(PRINTER_NAME_KEY);
}

export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  if (apiLevel < 31) return true;

  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return (
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function scanForPrinters(): Promise<PrinterDevice[]> {
  const native = loadNative();
  if (!native?.getDeviceList) return [];
  const ok = await ensureBluetoothPermissions();
  if (!ok) {
    throw new Error('Bluetooth permissions are required to scan for printers.');
  }
  return native.getDeviceList();
}

export async function connectPrinter(device: PrinterDevice): Promise<void> {
  const native = loadNative();
  if (!native?.connectPrinter) {
    throw new Error('Bluetooth printer requires a dev build with native module installed.');
  }
  const ok = await ensureBluetoothPermissions();
  if (!ok) {
    throw new Error('Bluetooth permissions are required to connect to a printer.');
  }
  await native.connectPrinter(device.address);
  await savePrinterAddress(device.address, device.name);
}

async function printRawToAddress(address: string, text: string): Promise<void> {
  const native = loadNative();
  if (!native?.printText) {
    throw new Error('Printer module not available in Expo Go. Use a dev build.');
  }
  const ok = await ensureBluetoothPermissions();
  if (!ok) {
    throw new Error('Bluetooth permissions are required to print.');
  }
  if (native.connectPrinter) await native.connectPrinter(address);
  await native.printText(`${text}\n\n\x1D\x56\x00`);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Print timed out')), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export async function printReceiptText(text: string): Promise<{ success: boolean; simulated?: boolean }> {
  const address = await savedPrinterAddress();
  const native = loadNative();

  if (!address) {
    throw new Error('No printer configured. Go to Settings → Printer.');
  }

  if (!native) {
    console.log('[PrinterService] SIMULATED PRINT:\n', text);
    return { success: true, simulated: true };
  }

  await withTimeout(printRawToAddress(address, text), PRINT_TIMEOUT_MS);
  return { success: true };
}

export async function printReceipt(
  sale: Sale,
  items: SaleItem[],
  settings: BusinessSettings,
): Promise<{ success: boolean; simulated?: boolean }> {
  const { display } = await loadReceiptBuildOptions(settings);
  const barcodes: Record<string, string | null> = {};
  for (const item of items) {
    const product = await getProductById(item.productId);
    barcodes[item.productId] = product?.barcode ?? null;
  }
  const text = buildReceiptText(sale, items, settings, display, barcodes);
  return printReceiptText(text);
}

export async function testPrint(): Promise<{ success: boolean; simulated?: boolean }> {
  const address = await savedPrinterAddress();
  const native = loadNative();
  const body = `POS Mini\nTest print\n${new Date().toLocaleString()}`;

  if (!address) {
    throw new Error('No printer configured.');
  }

  if (!native) {
    console.log('[PrinterService] SIMULATED TEST PRINT:\n', body);
    return { success: true, simulated: true };
  }

  await withTimeout(printRawToAddress(address, body), PRINT_TIMEOUT_MS);
  return { success: true };
}
