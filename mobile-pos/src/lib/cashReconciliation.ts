import { money } from "../api/shifts";

export type CashVarianceStatus = "BALANCED" | "OVERAGE" | "SHORTAGE";

/** Round to 2 decimal places (matches server NUMERIC(12,2)). */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Expected cash in drawer = opening float + cash sales this shift. */
export function computeExpectedCash(
  openingFloat: number | string | null | undefined,
  totalCash: number | string | null | undefined,
): number {
  return roundMoney(money(openingFloat) + money(totalCash));
}

/** closingCash − expectedCash (positive = overage, negative = shortage). */
export function computeCashVariance(
  expectedCash: number,
  closingCash: number | string | null | undefined,
): number {
  return roundMoney(money(closingCash) - expectedCash);
}

export function cashVarianceStatus(variance: number): CashVarianceStatus {
  const v = roundMoney(variance);
  if (v === 0) return "BALANCED";
  return v > 0 ? "OVERAGE" : "SHORTAGE";
}

export function varianceLabel(
  variance: number,
): { text: string; color: string; status: CashVarianceStatus } {
  const status = cashVarianceStatus(variance);
  if (status === "BALANCED") {
    return { text: "✅ Balanced — drawer matches expected cash", color: "text-emerald-600", status };
  }
  if (status === "OVERAGE") {
    return {
      text: `⚠️ Overage: RWF +${Math.abs(variance).toLocaleString()} in drawer`,
      color: "text-amber-600",
      status,
    };
  }
  return {
    text: `❌ Shortage: RWF ${Math.abs(variance).toLocaleString()} missing from drawer`,
    color: "text-red-600",
    status,
  };
}
