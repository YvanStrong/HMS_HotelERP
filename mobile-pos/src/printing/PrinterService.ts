// NOTE: Bluetooth printing requires a custom dev build.
// Run: npx eas build --profile development --platform android
// Then install the dev client on your device.
// In Expo Go, printing is simulated (logs to console only).

import Constants from "expo-constants";
import { money as shiftMoney, type PosShiftSummaryDTO } from "../api/shifts";
import { money, type TicketDetail } from "../api/tickets";
import { getBarCategories, getPrinter, setPrinter, type PrinterDevice, type PrinterRole } from "./PrinterConfig";
import { mmkvDelete, mmkvGetString, mmkvSetString } from "../storage/mmkv";

const LEGACY_KEY = "hms_printer_address";
const PRINT_TIMEOUT_MS = 5000;

export type { PrinterDevice };

type NativePrinter = {
  getDeviceList?: () => Promise<PrinterDevice[]>;
  connectPrinter?: (address: string) => Promise<void>;
  printText?: (text: string) => Promise<void>;
};

function loadNative(): NativePrinter | null {
  // require() succeeds in Expo Go but native bindings are missing — skip entirely.
  if (Constants.appOwnership === "expo") {
    return null;
  }
  try {
    return require("react-native-thermal-receipt-printer-image-qr") as NativePrinter;
  } catch {
    console.warn("[PrinterService] Native module not available. Running in simulation mode.");
    return null;
  }
}

export function isPrinterModuleAvailable(): boolean {
  return loadNative() != null;
}

/** @deprecated Use getPrinter("receipt") */
export function savedPrinterAddress(): string | null {
  const receipt = getPrinter("receipt");
  if (receipt) return receipt.address;
  return mmkvGetString(LEGACY_KEY);
}

export function savePrinterAddress(address: string): void {
  mmkvSetString(LEGACY_KEY, address);
  setPrinter("receipt", { name: "Receipt printer", address, type: "bluetooth" });
}

export function clearPrinterAddress(): void {
  mmkvDelete(LEGACY_KEY);
}

export async function scanForPrinters(): Promise<PrinterDevice[]> {
  const native = loadNative();
  if (!native?.getDeviceList) return [];
  return native.getDeviceList();
}

export async function connectPrinterForRole(role: PrinterRole, device: PrinterDevice): Promise<void> {
  const native = loadNative();
  if (!native?.connectPrinter) {
    throw new Error("Bluetooth printer requires a dev build with native module installed.");
  }
  await native.connectPrinter(device.address);
  setPrinter(role, device);
}

export async function connectPrinter(address: string): Promise<void> {
  await connectPrinterForRole("receipt", { name: "Receipt printer", address, type: "bluetooth" });
}

async function printRawToAddress(address: string, text: string): Promise<void> {
  const native = loadNative();
  if (!native?.printText) {
    throw new Error("Printer module not available in Expo Go. Use a dev build.");
  }
  if (native.connectPrinter) await native.connectPrinter(address);
  await native.printText(text + "\n\n\x1D\x56\x00");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Print timed out")), ms);
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

export async function fireAndForgetPrint(role: PrinterRole, fn: () => Promise<void>): Promise<void> {
  const device = getPrinter(role);
  if (!device) return;
  try {
    await withTimeout(fn(), PRINT_TIMEOUT_MS);
  } catch (err) {
    console.warn(`[printer:${role}]`, err);
  }
}

export async function printReceipt(
  ticket: TicketDetail,
  hotelName: string,
  role: PrinterRole = "receipt",
): Promise<{ success: boolean; simulated?: boolean }> {
  const device = getPrinter(role);
  const native = loadNative();
  if (!device) throw new Error("No receipt printer configured");
  if (!native) {
    console.log("[PrinterService] SIMULATED PRINT:", JSON.stringify({ ticket, hotelName }, null, 2));
    return { success: true, simulated: true };
  }

  const lines = ticket.lines
    .map(
      (l) =>
        `${l.productName.padEnd(18).slice(0, 18)} x${String(l.quantity).padStart(3)} ${money(l.lineTotal).toFixed(2)}`,
    )
    .join("\n");

  const body = [
    `[C]${hotelName}`,
    "--------------------------------",
    `Table: ${ticket.tableLabel}`,
    ticket.waiterName ? `Waiter: ${ticket.waiterName}` : "",
    `Date: ${ticket.closedAt ?? new Date().toISOString()}`,
    "--------------------------------",
    lines,
    "--------------------------------",
    `Subtotal:              ${money(ticket.subtotal).toFixed(2)}`,
    `Tax:                   ${money(ticket.taxAmount).toFixed(2)}`,
    `[B]TOTAL:               ${money(ticket.totalAmount).toFixed(2)}`,
    "--------------------------------",
    ticket.saleNumber ? `Invoice: #${ticket.saleNumber}` : "",
    ticket.deliveryNumber ? `Delivery: #${ticket.deliveryNumber}` : "",
    "--------------------------------",
    "[C]Thank you for your visit!",
  ]
    .filter(Boolean)
    .join("\n");

  await printRawToAddress(device.address, body);
  return { success: true };
}

export async function printKitchenTicket(
  tableLabel: string,
  round: number,
  lines: {
    productName: string;
    quantity: number | string;
    notes?: string | null;
    allergens?: string[];
  }[],
  role: PrinterRole = "kitchen",
): Promise<void> {
  const device = getPrinter(role);
  if (!device) throw new Error(`No ${role} printer configured`);

  const body = [
    role === "bar" ? "[B][C]BAR COPY" : "[B][C]KITCHEN COPY",
    `Table: ${tableLabel}  Round: ${round}`,
    `Time: ${new Date().toLocaleTimeString()}`,
    "--------------------------------",
    ...lines.flatMap((l) => {
      const rows = [`${l.productName} x${l.quantity}${l.notes ? `\n  ${l.notes}` : ""}`];
      if (l.allergens && l.allergens.length > 0) {
        rows.push(`  *** ALLERGEN: ${l.allergens.join(", ").toUpperCase()} ***`);
      }
      return rows;
    }),
    "--------------------------------",
  ].join("\n");

  await printRawToAddress(device.address, body);
}

const BAR_MENU_RE = /bar|beverage|drink|cocktail|wine|beer|spirit|coffee|café|juice/i;

/** @deprecated Prefer isBarItem with menuCategory from ticket lines. */
export function isBarMenuCategory(menuName: string | null | undefined): boolean {
  if (!menuName) return false;
  return BAR_MENU_RE.test(menuName.replace(/_/g, " "));
}

export function isBarItem(line: { menuCategory?: string | null; productName?: string | null }): boolean {
  const menu = line.menuCategory?.toLowerCase() ?? "";
  if (menu) {
    return getBarCategories().some((cat) => menu.includes(cat.toLowerCase()));
  }
  return isBarMenuCategory(line.productName);
}

export async function testPrintForRole(role: PrinterRole): Promise<void> {
  const device = getPrinter(role);
  if (!device) throw new Error("No printer configured for this role");
  await printRawToAddress(
    device.address,
    `[C]HMS Waiter\n${role.toUpperCase()} test\n${new Date().toLocaleString()}`,
  );
}

export async function testPrint(): Promise<void> {
  await testPrintForRole("receipt");
}

const RECEIPT_W = 32;

function receiptCenter(text: string): string {
  const s = text.slice(0, RECEIPT_W);
  const pad = Math.max(0, Math.floor((RECEIPT_W - s.length) / 2));
  return " ".repeat(pad) + s;
}

function receiptLr(left: string, right: string): string {
  const l = left.slice(0, RECEIPT_W - 1);
  const r = right.slice(0, RECEIPT_W - 1);
  const gap = RECEIPT_W - l.length - r.length;
  if (gap < 1) return `${l} ${r}`.slice(0, RECEIPT_W);
  return l + " ".repeat(gap) + r;
}

function fmtRw(v: number | string): string {
  return shiftMoney(v).toFixed(0);
}

function shiftDurationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
}

export async function printShiftSummary(
  summary: PosShiftSummaryDTO,
  hotelName: string,
): Promise<{ success: boolean; simulated?: boolean }> {
  const device = getPrinter("receipt");
  const native = loadNative();
  const opened = new Date(summary.openedAt);
  const closed = summary.closedAt ? new Date(summary.closedAt) : new Date();
  const variance = shiftMoney(summary.cashVariance);
  const varStatus = summary.cashVarianceStatus ?? "BALANCED";

  const lines: string[] = [
    receiptCenter("================================"),
    `[C]${hotelName.slice(0, RECEIPT_W)}`,
    receiptCenter("SHIFT REPORT"),
    receiptCenter("================================"),
    receiptLr("Outlet:", summary.depotName.slice(0, 22)),
    receiptLr("Waiter:", summary.waiterName.slice(0, 22)),
    receiptLr("Date:", opened.toLocaleDateString()),
    receiptLr("Opened:", opened.toLocaleTimeString()),
    receiptLr("Closed:", closed.toLocaleTimeString()),
    receiptLr("Duration:", shiftDurationLabel(summary.durationMinutes)),
    "--------------------------------",
    receiptCenter("ORDERS SUMMARY"),
    "--------------------------------",
    receiptLr("Total Orders:", String(summary.totalOrders)),
    receiptLr("Total Covers:", String(summary.totalCovers)),
    receiptLr("Cancelled:", String(summary.totalCancelled)),
    receiptLr("Avg Ticket:", `RWF ${fmtRw(summary.avgTicketValue)}`),
    receiptLr("Avg Serve:", `${fmtRw(summary.avgServeTimeMin)} min`),
    "--------------------------------",
    receiptCenter("REVENUE BREAKDOWN"),
    "--------------------------------",
    receiptLr("Cash:", `RWF ${fmtRw(summary.totalCash)}`),
    receiptLr("Card:", `RWF ${fmtRw(summary.totalCard)}`),
    receiptLr("Room:", `RWF ${fmtRw(summary.totalRoomCharge)}`),
    receiptLr("Tax:", `RWF ${fmtRw(summary.totalTax)}`),
    receiptLr("Tips:", `RWF ${fmtRw(summary.totalTips ?? 0)}`),
    `[B]${receiptLr("TOTAL:", `RWF ${fmtRw(summary.totalRevenue)}`)}`,
    "--------------------------------",
    receiptCenter("CASH RECONCILIATION"),
    "--------------------------------",
    receiptLr("Opening:", `RWF ${fmtRw(summary.openingFloat)}`),
    receiptLr("Cash Sales:", `RWF ${fmtRw(summary.totalCash)}`),
    receiptLr(
      "Expected:",
      `RWF ${fmtRw(
        summary.expectedCash != null
          ? shiftMoney(summary.expectedCash)
          : shiftMoney(summary.openingFloat) + shiftMoney(summary.totalCash),
      )}`,
    ),
    receiptLr("Counted:", `RWF ${fmtRw(summary.closingCash ?? 0)}`),
    receiptLr("Variance:", `RWF ${variance} ${varStatus}`),
    "--------------------------------",
    receiptCenter("TOP ITEMS"),
    "--------------------------------",
    ...summary.topItems.slice(0, 5).map((item, i) =>
      `${i + 1}. ${item.productName}`.slice(0, 18) +
        ` x${item.qtySold} ` +
        `RWF${fmtRw(item.revenue)}`.slice(0, RECEIPT_W - 20),
    ),
    "--------------------------------",
  ];

  if (summary.closingNotes?.trim()) {
    lines.push(summary.closingNotes.trim().slice(0, RECEIPT_W));
    lines.push("--------------------------------");
  }

  lines.push(receiptLr("Printed:", new Date().toLocaleString().slice(0, 22)));
  lines.push(receiptCenter("================================"));

  const body = lines.join("\n");

  if (!device || !native) {
    console.log("[PrinterService] SIMULATED SHIFT PRINT:\n", body);
    return { success: true, simulated: true };
  }

  await printRawToAddress(device.address, body);
  return { success: true };
}
