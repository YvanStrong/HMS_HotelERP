export function formatQuantity(qty: number): string {
  if (Number.isInteger(qty)) return String(qty);
  return String(Math.round(qty * 1000) / 1000);
}

export function parseQuantityInput(input: string): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}
