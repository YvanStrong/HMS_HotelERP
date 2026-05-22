"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HMS_CHART_AXIS, HMS_CHART_GRID, HMS_CHART_TICK, paletteAt } from "./chartTheme";

type Datum = { label: string; value: number; color?: string };

type Props = {
  data: Datum[];
  /** Switch the orientation. Default is vertical bars. */
  layout?: "vertical" | "horizontal";
  /** Format the value in tooltip / labels. */
  formatValue?: (n: number) => string;
  /** When true, draws value labels on top of each bar. */
  showValues?: boolean;
  /** Optional human-friendly axis label. */
  yAxisLabel?: string;
};

const defaultFmt = (n: number) => n.toLocaleString();

export function HmsBarChart({
  data,
  layout = "vertical",
  formatValue = defaultFmt,
  showValues = false,
  yAxisLabel,
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data to chart
      </div>
    );
  }

  if (layout === "horizontal") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 6, right: 24, bottom: 6, left: 8 }}
        >
          <CartesianGrid stroke={HMS_CHART_GRID} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(n) => formatValue(Number(n))}
            stroke={HMS_CHART_AXIS}
            tick={{ fontSize: 11, fill: HMS_CHART_TICK }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            stroke={HMS_CHART_AXIS}
            tick={{ fontSize: 11, fill: HMS_CHART_TICK }}
          />
          <Tooltip
            cursor={{ fill: "rgba(20,83,45,0.04)" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid rgba(20,83,45,0.12)",
              background: "#fff",
            }}
            formatter={(value) => [formatValue(Number(value)), yAxisLabel ?? "Value"]}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={d.color ?? paletteAt(i)} />
            ))}
            {showValues && (
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: number) => formatValue(Number(value))}
                style={{ fontSize: 11, fill: HMS_CHART_TICK }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 6, left: 8 }}>
        <CartesianGrid stroke={HMS_CHART_GRID} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={HMS_CHART_AXIS}
          tick={{ fontSize: 11, fill: HMS_CHART_TICK }}
          interval={0}
          angle={data.length > 6 ? -25 : 0}
          textAnchor={data.length > 6 ? "end" : "middle"}
          height={data.length > 6 ? 56 : 30}
        />
        <YAxis
          stroke={HMS_CHART_AXIS}
          tick={{ fontSize: 11, fill: HMS_CHART_TICK }}
          tickFormatter={(n) => formatValue(Number(n))}
        />
        <Tooltip
          cursor={{ fill: "rgba(20,83,45,0.04)" }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid rgba(20,83,45,0.12)",
            background: "#fff",
          }}
          formatter={(value) => [formatValue(Number(value)), yAxisLabel ?? "Value"]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={28}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={d.color ?? paletteAt(i)} />
          ))}
          {showValues && (
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value: number) => formatValue(Number(value))}
              style={{ fontSize: 11, fill: HMS_CHART_TICK }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
