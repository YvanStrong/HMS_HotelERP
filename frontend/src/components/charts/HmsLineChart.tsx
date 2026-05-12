"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HMS_CHART_AXIS, HMS_CHART_GRID, HMS_CHART_TICK, paletteAt } from "./chartTheme";

export type LineSeries = {
  /** Object key on each data point. */
  key: string;
  /** Human-friendly name shown in tooltip / legend. */
  label: string;
  /** "line" | "area" | "bar" */
  type?: "line" | "area" | "bar";
  /** Override line colour. Defaults to palette by index. */
  color?: string;
  /** When true, this series uses the right-hand Y axis. */
  yAxisId?: "left" | "right";
  /** Optional formatter for tooltip / labels. */
  format?: (n: number) => string;
};

type Props = {
  /** Each row must include all series keys plus the `xKey`. */
  data: Record<string, unknown>[];
  /** Object key for the x-axis label (e.g. "date"). */
  xKey: string;
  series: LineSeries[];
  /** Pass true to display a right-side y-axis (used when any series sets `yAxisId: "right"`). */
  rightAxis?: boolean;
  /** Render an axis label on the left side. */
  leftAxisLabel?: string;
  rightAxisLabel?: string;
  /** Format the X axis tick labels (e.g. shorten an ISO date). */
  formatXTick?: (v: string) => string;
};

const defaultFmt = (n: number) => Number(n).toLocaleString();

export function HmsLineChart({
  data,
  xKey,
  series,
  rightAxis = false,
  leftAxisLabel,
  rightAxisLabel,
  formatXTick,
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data to chart
      </div>
    );
  }
  const showLegend = series.length > 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: rightAxis ? 16 : 8, bottom: 6, left: 8 }}>
        <defs>
          {series
            .filter((s) => (s.type ?? "line") === "area")
            .map((s, i) => {
              const c = s.color ?? paletteAt(i);
              return (
                <linearGradient
                  key={s.key}
                  id={`hms-area-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.04} />
                </linearGradient>
              );
            })}
        </defs>
        <CartesianGrid stroke={HMS_CHART_GRID} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: HMS_CHART_TICK }}
          stroke={HMS_CHART_AXIS}
          interval="preserveStartEnd"
          tickFormatter={formatXTick ? (v: string) => formatXTick(String(v)) : undefined}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: HMS_CHART_TICK }}
          stroke={HMS_CHART_AXIS}
          tickFormatter={(n) => defaultFmt(Number(n))}
          label={
            leftAxisLabel
              ? {
                  value: leftAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: HMS_CHART_TICK },
                }
              : undefined
          }
        />
        {rightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: HMS_CHART_TICK }}
            stroke={HMS_CHART_AXIS}
            tickFormatter={(n) => defaultFmt(Number(n))}
            label={
              rightAxisLabel
                ? {
                    value: rightAxisLabel,
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 11, fill: HMS_CHART_TICK },
                  }
                : undefined
            }
          />
        )}
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid rgba(58,45,40,0.12)",
            background: "#fff",
          }}
          formatter={(value, name) => {
            const s = series.find((x) => x.label === name || x.key === name);
            const fmt = s?.format ?? defaultFmt;
            return [fmt(Number(value)), (s?.label ?? String(name)) as string];
          }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: HMS_CHART_TICK, paddingTop: 4 }}
            iconType="circle"
          />
        )}
        {series.map((s, i) => {
          const c = s.color ?? paletteAt(i);
          const yId = s.yAxisId ?? "left";
          if (s.type === "bar") {
            return (
              <Bar
                key={s.key}
                yAxisId={yId}
                dataKey={s.key}
                name={s.label}
                fill={c}
                radius={[4, 4, 0, 0]}
                barSize={14}
              />
            );
          }
          if (s.type === "area") {
            return (
              <Area
                key={s.key}
                yAxisId={yId}
                dataKey={s.key}
                name={s.label}
                stroke={c}
                strokeWidth={2}
                fill={`url(#hms-area-${s.key})`}
                type="monotone"
              />
            );
          }
          return (
            <Line
              key={s.key}
              yAxisId={yId}
              dataKey={s.key}
              name={s.label}
              stroke={c}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              type="monotone"
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
