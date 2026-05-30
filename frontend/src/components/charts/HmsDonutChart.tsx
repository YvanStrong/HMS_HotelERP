"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { paletteAt } from "./chartTheme";

type Slice = { name: string; value: number; color?: string };

type Props = {
  data: Slice[];
  /** Optional centered text (e.g. total). */
  centerLabel?: string;
  centerSub?: string;
  /** Hide the legend block on the right. */
  hideLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
};

export function HmsDonutChart({
  data,
  centerLabel,
  centerSub,
  hideLegend = false,
  innerRadius = 55,
  outerRadius = 80,
}: Props) {
  const total = data.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0);
  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data to chart
      </div>
    );
  }
  return (
    <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
      <div className="relative h-full min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid rgba(26,58,92,0.12)",
                background: "#fff",
              }}
              formatter={(value: number, name) => {
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return [`${Number(value).toLocaleString()} (${pct}%)`, name as string];
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              stroke="#fff"
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? paletteAt(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerSub) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerLabel && <p className="text-xl font-bold text-foreground">{centerLabel}</p>}
            {centerSub && <p className="text-[11px] text-muted-foreground">{centerSub}</p>}
          </div>
        )}
      </div>
      {!hideLegend && (
        <ul className="grid max-h-full grid-cols-1 gap-1.5 overflow-auto text-xs sm:grid-cols-2 md:flex md:flex-col md:pl-2">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ background: d.color ?? paletteAt(i) }}
                />
                <span className="truncate text-muted-foreground">{d.name}</span>
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {Number(d.value).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
