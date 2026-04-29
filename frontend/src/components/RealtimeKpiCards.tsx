"use client";

import { useEffect, useState } from "react";

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

const categoryConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
  revenue: { 
    icon: "💰", 
    color: "text-emerald-600", 
    bgColor: "bg-emerald-50 border-emerald-200" 
  },
  occupancy: { 
    icon: "🏨", 
    color: "text-blue-600", 
    bgColor: "bg-blue-50 border-blue-200" 
  },
  arrivals: { 
    icon: "🛬", 
    color: "text-amber-600", 
    bgColor: "bg-amber-50 border-amber-200" 
  },
  housekeeping: { 
    icon: "🧹", 
    color: "text-purple-600", 
    bgColor: "bg-purple-50 border-purple-200" 
  },
  departures: { 
    icon: "🛫", 
    color: "text-rose-600", 
    bgColor: "bg-rose-50 border-rose-200" 
  },
};

function formatLabel(label: string): string {
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatValue(value: number, label: string): string {
  if (label.toLowerCase().includes("rate") || label.toLowerCase().includes("percentage") || label.toLowerCase().includes("percent")) {
    return `${value}%`;
  }
  if (label.toLowerCase().includes("revenue") || label.toLowerCase().includes("amount") || label.toLowerCase().includes("price")) {
    return `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

/** Renders realtime dashboard metrics as beautiful metric cards */
export function RealtimeKpiCards({ liveMetrics }: { liveMetrics: Record<string, unknown> | undefined }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!liveMetrics || Object.keys(liveMetrics).length === 0) return null;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Object.entries(liveMetrics).map(([title, raw], index) => {
        const nums = numericEntries(raw);
        const config = categoryConfig[title.toLowerCase()] || { 
          icon: "📊", 
          color: "text-slate-600", 
          bgColor: "bg-slate-50 border-slate-200" 
        };
        
        // Calculate totals for percentage bars
        const total = nums.length > 0 ? nums.reduce((sum, n) => sum + n.value, 0) : 1;
        const maxVal = nums.length ? Math.max(1, ...nums.map((n) => Math.abs(n.value))) : 1;
        
        return (
          <div 
            key={title} 
            className={`bg-white rounded-xl border shadow-soft overflow-hidden transition-all duration-500 hover:shadow-float ${config.bgColor} ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-inherit flex items-center gap-3">
              <span className="text-2xl">{config.icon}</span>
              <h3 className="font-semibold text-foreground capitalize">{title}</h3>
            </div>
            
            {/* Content */}
            <div className="p-4">
              {nums.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {typeof raw === "string" ? raw : JSON.stringify(raw)}
                </p>
              ) : (
                <div className="space-y-3">
                  {nums.map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{formatLabel(label)}</span>
                        <span className={`font-bold ${config.color}`}>
                          {formatValue(value, label)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${config.color.replace('text-', 'bg-')}`}
                          style={{ 
                            width: mounted ? `${Math.min(100, (Math.abs(value) / maxVal) * 100)}%` : '0%',
                            transitionDelay: `${index * 100 + 200}ms`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer with total if applicable */}
            {nums.length > 1 && total > 0 && (
              <div className="px-4 py-2 bg-white/30 border-t border-inherit">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold text-foreground">{formatValue(total, "total")}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
