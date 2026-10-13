/** Direct USB / local-agent print for ESC/POS receipt printers (Xprinter, Epson, and similar). */

const AGENT_ORIGIN = "http://127.0.0.1:17888";
const LS_READY = "hms_epson_direct";

/**
 * USB vendor ids used by Xprinter and other 80mm receipt printers.
 * Filters are OR'd. Class 0x07 is the printer class; 0xFF is the vendor-specific
 * class many Xprinter models use, which a printer-class filter will miss.
 */
const PRINTER_FILTERS: { vendorId?: number; classCode?: number }[] = [
  { classCode: 0x07 },
  { classCode: 0xff },
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0483 }, // Xprinter (STMicro) XP-58 / XP-80
  { vendorId: 0x0416 }, // Xprinter / Winbond
  { vendorId: 0x0fe6 }, // Xprinter / ICS
  { vendorId: 0x28e9 }, // Xprinter / GigaDevice
  { vendorId: 0x1fc9 }, // Xprinter / NXP
  { vendorId: 0x4b43 }, // Xprinter
  { vendorId: 0x6868 },
  { vendorId: 0x2d84 },
  { vendorId: 0x20d1 },
  { vendorId: 0x0519 }, // Star
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x0dd4 },
  { vendorId: 0x154f }, // SNBC
  { vendorId: 0x1a86 }, // CH340 serial bridge
  { vendorId: 0x067b }, // Prolific
  { vendorId: 0x10c4 }, // CP210x
  { vendorId: 0x0403 }, // FTDI
  { vendorId: 0x0525 },
];

type UsbEndpointLike = { direction: string; endpointNumber: number };
type UsbInterfaceLike = {
  interfaceNumber: number;
  claimed: boolean;
  alternate: { endpoints: UsbEndpointLike[] };
  alternates?: { endpoints: UsbEndpointLike[] }[];
};

type UsbDeviceLike = {
  productName?: string | null;
  manufacturerName?: string | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (n: number) => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  selectAlternateInterface?: (interfaceNumber: number, alternateSetting: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<unknown>;
  configuration: { interfaces: UsbInterfaceLike[] } | null;
  configurations?: { configurationValue: number; interfaces: UsbInterfaceLike[] }[];
};

type AgentHealth = {
  ok?: boolean;
  printer?: string | null;
  printers?: { name: string; port?: string }[];
};

export type ReceiptPrinterStatus = {
  connected: boolean;
  label: string;
};

function usbApi(): {
  getDevices: () => Promise<UsbDeviceLike[]>;
  requestDevice: (opts: { filters: { vendorId?: number; classCode?: number }[] }) => Promise<UsbDeviceLike>;
} | null {
  if (typeof navigator === "undefined") return null;
  const usb = (navigator as Navigator & {
    usb?: {
      getDevices: () => Promise<UsbDeviceLike[]>;
      requestDevice: (opts: { filters: { vendorId?: number; classCode?: number }[] }) => Promise<UsbDeviceLike>;
    };
  }).usb;
  return usb ?? null;
}

function deviceLabel(device: UsbDeviceLike): string {
  const name = [device.manufacturerName, device.productName].filter(Boolean).join(" ").trim();
  return name || "Xprinter";
}

export function isDirectPrintSupported(): boolean {
  return Boolean(usbApi()) || typeof window !== "undefined";
}

export function wasDirectPrinterConnected(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LS_READY) === "1";
}

async function probeAgent(): Promise<AgentHealth | null> {
  try {
    const res = await fetch(`${AGENT_ORIGIN}/health`, { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AgentHealth;
  } catch {
    return null;
  }
}

/** What this browser can print to right now (local agent or a USB device already allowed). */
export async function probeReceiptPrinter(): Promise<ReceiptPrinterStatus> {
  const agent = await probeAgent();
  const selected = agent?.printer && agent.printer !== "none" ? agent.printer : null;
  if (selected) {
    return { connected: true, label: `Printer ready: ${selected}` };
  }
  const usb = usbApi();
  if (usb) {
    try {
      const devices = await usb.getDevices();
      if (devices.length > 0) {
        return { connected: true, label: `USB printer ready: ${deviceLabel(devices[0])}` };
      }
    } catch {
      /* permission not granted yet */
    }
  }
  if (!usb) {
    return {
      connected: false,
      label: "Open this POS in Chrome or Edge on the PC where the Xprinter USB cable is plugged in.",
    };
  }
  return {
    connected: false,
    label: "Xprinter not detected. Click Connect Xprinter and choose the printer in the list.",
  };
}

export async function connectEpsonUsbPrinter(): Promise<string> {
  const usb = usbApi();
  if (!usb) {
    const agent = await probeAgent();
    if (agent?.printer && agent.printer !== "none") {
      window.localStorage.setItem(LS_READY, "1");
      return `Printer ready: ${agent.printer}. Receipts print on that Xprinter.`;
    }
    throw new Error(
      "Use Chrome or Edge on the computer where the Xprinter is plugged in with USB, then click Connect Xprinter.",
    );
  }

  let device: UsbDeviceLike;
  try {
    device = await usb.requestDevice({ filters: PRINTER_FILTERS });
  } catch (e) {
    const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
    if (name === "NotFoundError") {
      const agent = await probeAgent();
      if (agent?.printer && agent.printer !== "none") {
        window.localStorage.setItem(LS_READY, "1");
        return `Printer ready: ${agent.printer}. Receipts print on that Xprinter.`;
      }
      throw new Error(
        "The Xprinter did not appear. Unplug the USB cable, plug it back in, then click Connect Xprinter and pick Xprinter (or USB Printing Support). If Windows already installed a driver, keep the HMS print helper running on this same PC.",
      );
    }
    throw e instanceof Error ? e : new Error("Could not connect the Xprinter.");
  }

  await sendUsb(device, new Uint8Array([0x1b, 0x40]));
  window.localStorage.setItem(LS_READY, "1");
  return `USB printer connected: ${deviceLabel(device)}. The next receipt prints on it.`;
}

function outEndpoints(iface: UsbInterfaceLike): UsbEndpointLike[] {
  const lists = [iface.alternate?.endpoints ?? []];
  for (const alt of iface.alternates ?? []) lists.push(alt.endpoints ?? []);
  const seen = new Set<number>();
  const out: UsbEndpointLike[] = [];
  for (const list of lists) {
    for (const ep of list) {
      if (String(ep.direction).toLowerCase() !== "out") continue;
      if (seen.has(ep.endpointNumber)) continue;
      seen.add(ep.endpointNumber);
      out.push(ep);
    }
  }
  return out;
}

async function sendUsb(device: UsbDeviceLike, bytes: Uint8Array): Promise<void> {
  await device.open();
  try {
    if (!device.configuration) {
      const value = device.configurations?.[0]?.configurationValue ?? 1;
      await device.selectConfiguration(value);
    }
    const ifaces = device.configuration?.interfaces ?? [];
    let endpoint = -1;
    for (const iface of ifaces) {
      const eps = outEndpoints(iface);
      if (eps.length === 0 && device.selectAlternateInterface) {
        try {
          await device.selectAlternateInterface(iface.interfaceNumber, 0);
        } catch {
          /* try claim anyway */
        }
      }
      const candidates = outEndpoints(iface);
      if (candidates.length === 0) continue;
      try {
        if (!iface.claimed) await device.claimInterface(iface.interfaceNumber);
      } catch {
        continue;
      }
      endpoint = candidates[0].endpointNumber;
      break;
    }
    if (endpoint < 0) {
      throw new Error(
        "Could not open the Xprinter. Unplug it, plug it in again, then click Connect Xprinter. If Windows already installed a driver, close other apps that are printing and try once more.",
      );
    }
    const CHUNK = 1024;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      await device.transferOut(endpoint, bytes.subarray(i, Math.min(bytes.length, i + CHUNK)));
    }
  } finally {
    try {
      await device.close();
    } catch {
      /* ignore */
    }
  }
}

async function printViaWebUsb(bytes: Uint8Array): Promise<boolean> {
  const usb = usbApi();
  if (!usb) return false;
  const devices = await usb.getDevices();
  const printer = devices[0];
  if (!printer) return false;
  await sendUsb(printer, bytes);
  window.localStorage.setItem(LS_READY, "1");
  return true;
}

async function printViaLocalAgent(bytes: Uint8Array): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_ORIGIN}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      window.localStorage.setItem(LS_READY, "1");
      return true;
    }
  } catch {
    /* agent not running on this PC */
  }
  return false;
}

/** Returns true when the receipt printer printed without the browser dialog. */
export async function tryDirectThermalPrint(bytes: Uint8Array): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (await printViaLocalAgent(bytes)) return true;
  try {
    if (await printViaWebUsb(bytes)) return true;
  } catch {
    return false;
  }
  return false;
}
