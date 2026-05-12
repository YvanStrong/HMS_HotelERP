"use client";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

type Props = {
  /** Numeric value, will be clamped against `max`. */
  value: number;
  /** Upper bound. Defaults to 100 (percentage gauge). */
  max?: number;
  /** Centered headline label. */
  label: string;
  /** Optional supporting text under the value. */
  caption?: string;
  /** Hex colour for the bar. Defaults to rosewood primary. */
  color?: string;
  /** Optional formatter for displayed value. */
  formatValue?: (n: number) => string;
};

const defaultFmt = (n: number) => `${n.toFixed(1)}%`;

export function HmsRadialGauge({
  value,
  max = 100,
  label,
  caption,
  color = "#a48374",
  formatValue = defaultFmt,
}: Props) {
  const clamped = Math.max(0, Math.min(value, max));
  const data = [{ name: label, value: clamped, fill: color }];
  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="68%"
          outerRadius="92%"
          data={data}
          startAngle={210}
          endAngle={-30}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar background={{ fill: "rgba(58,45,40,0.08)" }} dataKey="value" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-2xl font-bold text-foreground">{formatValue(clamped)}</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
      </div>
    </div>
  );
}
