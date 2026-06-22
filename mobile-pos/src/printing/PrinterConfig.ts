import { mmkvDelete, mmkvGetString, mmkvSetString } from "../storage/mmkv";



export type PrinterRole = "receipt" | "kitchen" | "bar";



export type PrinterDevice = {

  name: string;

  address: string;

  type: string;

};



const KEYS: Record<PrinterRole, string> = {

  receipt: "printer-receipt",

  kitchen: "printer-kitchen",

  bar: "printer-bar",

};



export function getPrinter(role: PrinterRole): PrinterDevice | null {

  const raw = mmkvGetString(KEYS[role]);

  if (!raw) return null;

  try {

    return JSON.parse(raw) as PrinterDevice;

  } catch {

    return null;

  }

}



export function setPrinter(role: PrinterRole, device: PrinterDevice): void {

  mmkvSetString(KEYS[role], JSON.stringify(device));

}



export function clearPrinter(role: PrinterRole): void {

  mmkvDelete(KEYS[role]);

}



export function getAllPrinters(): Record<PrinterRole, PrinterDevice | null> {

  return {

    receipt: getPrinter("receipt"),

    kitchen: getPrinter("kitchen"),

    bar: getPrinter("bar"),

  };

}


