"use client";

import { ChartCard } from "./ChartCard";
import { HmsBarChart } from "./HmsBarChart";
import { HmsDonutChart } from "./HmsDonutChart";
import { paletteAt } from "./chartTheme";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function numericEntries(raw: unknown): { label: string; value: number }[] {
  const obj = asRecord(raw);
  if (!obj) return [];
  const out: { label: string; value: number }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out.push({ label: k, value: v });
    }
  }
  return out;
}

function formatLabel(label: string): string {
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

const CATEGORY_HINT: Record<string, string> = {
  revenue: "Today's revenue split",
  occupancy: "Live occupancy snapshot",
  arrivals: "Expected vs actual arrivals",
  housekeeping: "Room status counts",
  departures: "Departures and balances",
  complaints: "Open guest complaints",
};

/** Charts variant of RealtimeKpiCards — same input shape, but draws bar/donut charts per group. */
export function RealtimeKpiCharts({ liveMetrics }: { liveMetrics: Record<string, unknown> | undefined }) {
  if (!liveMetrics || Object.keys(liveMetrics).length === 0) {
    return (
      <div className="hms-empty-state">
        <p className="hms-empty-title">No live metrics in this snapshot</p>
        <p className="hms-empty-copy">Realtime KPI charts appear here when event traffic is available.</p>
      </div>
    );
  }

  const entries = Object.entries(liveMetrics);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {entries.map(([title, raw]) => {
        const nums = numericEntries(raw);
        const subtitle = CATEGORY_HINT[title.toLowerCase()] ?? "Live snapshot";
        const data = nums.map((n, i) => ({
          label: formatLabel(n.label),
          value: n.value,
          color: paletteAt(i),
        }));
        const sum = data.reduce((s, d) => s + d.value, 0);
        const isShare = sum > 0 && data.length >= 2 && data.length <= 6;

        return (
          <ChartCard
            key={title}
            title={title.replace(/^./, (s) => s.toUpperCase())}
            subtitle={subtitle}
            empty={data.length === 0}
            emptyTitle="No numeric metrics"
            emptyHint={
              typeof raw === "string"
                ? raw
                : "This category does not include any numeric measurements right now."
            }
            bodyHeight={220}
          >
            {isShare ? (
              <HmsDonutChart
                data={data.map((d) => ({ name: d.label, value: d.value, color: d.color }))}
                centerLabel={sum.toLocaleString()}
                centerSub="total"
              />
            ) : (
              <HmsBarChart
                data={data}
                layout={data.length > 4 ? "horizontal" : "vertical"}
                showValues
              />
            )}
          </ChartCard>
        );
      })}
    </div>
  );
}
