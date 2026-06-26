export function isValidBarcode(value: string): boolean {
  const cleaned = value.replace(/\s/g, '');
  return /^\d{8,14}$/.test(cleaned) || /^[A-Z0-9-]{4,32}$/i.test(cleaned);
}

export function normalizeBarcode(value: string): string {
  return value.trim().replace(/\s/g, '');
}

export function generateSku(prefix = 'SKU'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateEan13CheckDigit(digits12: string): string {
  if (!/^\d{12}$/.test(digits12)) return digits12;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(digits12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${digits12}${check}`;
}

export type ScaleBarcodeResult = {
  productCode: string;
  weightKg?: number;
  price?: number;
};

/** Parse EAN-13 scale barcodes (prefix 20-29) with embedded weight or price. */
export function parseScaleBarcode(barcode: string): ScaleBarcodeResult | null {
  const cleaned = normalizeBarcode(barcode);
  if (!/^\d{13}$/.test(cleaned)) return null;
  const prefix = Number(cleaned.slice(0, 2));
  if (prefix < 20 || prefix > 29) return null;

  const productCode = cleaned.slice(0, 7);
  const valueDigits = cleaned.slice(7, 12);
  const value = Number(valueDigits);

  // Heuristic: values > 5000 treated as price (cents), else weight (grams)
  if (value > 5000) {
    return { productCode, price: value / 100 };
  }
  return { productCode, weightKg: value / 1000 };
}
