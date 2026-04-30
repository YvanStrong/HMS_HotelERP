"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";
import { paginateSlice } from "@/lib/pagination";

function monthRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

type OccupancyReport = {
  reportType: string;
  summary: Record<string, unknown>;
  data: Record<string, unknown>[];
};

type GuestAnalyticsReport = {
  reportType: string;
  filters: Record<string, unknown>;
  summary: Record<string, unknown>;
  insights: Record<string, unknown>[];
  segments: Record<string, unknown>[];
};

type NightAuditRun = {
  run_date: string;
  rooms_audited: number;
  charges_posted: number;
  total_amount: number;
  status: string;
  errors?: string | null;
  run_at: string;
  run_by: string;
};

type Executive = {
  timestamp: string;
  todaysOperations: Array<{ key: string; title: string; valueDisplay: string; subtext: string; tone: string }>;
  revenueCards: Array<{ key: string; title: string; valueDisplay: string; subtext: string; tone: string }>;
  operationsAlerts: Array<{ key: string; title: string; valueDisplay: string; subtext: string; tone: string }>;
};

const OCC_PAGE = 10;
const INSIGHT_PAGE = 6;
const SEG_PAGE = 6;

export default function HotelReportsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [tab, setTab] = useState<"executive" | "occupancy" | "guests" | "audit">("executive");
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [executive, setExecutive] = useState<Executive | null>(null);
  const [guestAnalytics, setGuestAnalytics] = useState<GuestAnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [occPage, setOccPage] = useState(1);
  const [insPage, setInsPage] = useState(1);
  const [segPage, setSegPage] = useState(1);
  const [audits, setAudits] = useState<NightAuditRun[]>([]);
  const [auditMsg, setAuditMsg] = useState<string | null>(null);
  const [showAuditConfirm, setShowAuditConfirm] = useState(false);
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const user = typeof window !== "undefined" ? loadAuthUser() : null;
  const [startDate, setStartDate] = useState(monthRange().start);
  const [endDate, setEndDate] = useState(monthRange().end);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        return;
      }
      setLoading(true);
      try {
        const [ex, o, g, hist] = await Promise.all([
          apiFetch<Executive>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`),
          apiFetch<OccupancyReport>(
            `/api/v1/hotels/${hotelId}/reports/occupancy?startDate=${startDate}&endDate=${endDate}&groupBy=day`,
          ),
          apiFetch<GuestAnalyticsReport>(
            `/api/v1/hotels/${hotelId}/reports/guest-analytics?segment=RETURNING&tier=GOLD&minSpend=500`,
          ),
          apiFetch<NightAuditRun[]>(`/api/v1/hotels/${hotelId}/night-audit/history`),
        ]);
        if (cancelled) return;
        setExecutive(ex);
        setOccupancy(o);
        setGuestAnalytics(g);
        setAudits(hist);
        setOccPage(1);
        setInsPage(1);
        setSegPage(1);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, startDate, endDate]);

  const occRows = occupancy?.data ?? [];
  const occPaged = useMemo(() => paginateSlice(occRows, occPage, OCC_PAGE), [occRows, occPage]);

  const insights = guestAnalytics?.insights ?? [];
  const insPaged = useMemo(() => paginateSlice(insights, insPage, INSIGHT_PAGE), [insights, insPage]);

  const segments = guestAnalytics?.segments ?? [];
  const segPaged = useMemo(() => paginateSlice(segments, segPage, SEG_PAGE), [segments, segPage]);

  async function runNightAuditNow() {
    setAuditMsg(null);
    setAuditSubmitting(true);
    try {
      const run = await apiFetch<NightAuditRun>(`/api/v1/hotels/${hotelId}/night-audit/run`, { method: "POST" });
      setAuditMsg(`Audit complete: ${run.charges_posted} charges posted`);
      const hist = await apiFetch<NightAuditRun[]>(`/api/v1/hotels/${hotelId}/night-audit/history`);
      setAudits(hist);
      setShowAuditConfirm(false);
    } catch (e) {
      setAuditMsg(e instanceof Error ? e.message : "Night audit failed");
    } finally {
      setAuditSubmitting(false);
    }
  }

  async function exportFile(url: string, filename: string) {
    try {
      const token = getToken();
      if (!token) throw new Error("Not signed in.");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
      setBanner(`Downloaded ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">Executive KPIs, occupancy, guest analytics, and audit controls</p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tab === "executive" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("executive")}>Executive</button>
          <button type="button" className={tab === "occupancy" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("occupancy")}>Occupancy</button>
          <button type="button" className={tab === "guests" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("guests")}>Guest Analytics</button>
          <button type="button" className={tab === "audit" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("audit")}>Night Audit</button>
        </div>
      </div>

      {loading && <div className="panel">Loading reports...</div>}
      {error && <div className="error panel">{error}</div>}
      {banner && <div className="panel">{banner}</div>}

      {tab === "executive" && executive && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {executive.todaysOperations.map((k) => (
              <div key={k.key} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
                <p className="text-xs text-muted-foreground">{k.title}</p>
                <p className="text-2xl font-bold">{k.valueDisplay}</p>
                <p className="text-xs text-muted-foreground">{k.subtext}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {executive.revenueCards.map((k) => (
              <div key={k.key} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
                <p className="text-xs text-muted-foreground">{k.title}</p>
                <p className="text-2xl font-bold">{k.valueDisplay}</p>
                <p className="text-xs text-muted-foreground">{k.subtext}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "occupancy" && occupancy && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div><label>Start</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><label>End</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div className="flex items-end"><button type="button" className="hms-btn-outline w-full" onClick={() => void exportFile(`/api/v1/hotels/${hotelId}/reports/occupancy/export?startDate=${startDate}&endDate=${endDate}&groupBy=day&format=csv`, "occupancy-report.csv")}>Export CSV</button></div>
              <div className="flex items-end"><button type="button" className="hms-btn-outline w-full" onClick={() => void exportFile(`/api/v1/hotels/${hotelId}/reports/occupancy/export?startDate=${startDate}&endDate=${endDate}&groupBy=day&format=pdf`, "occupancy-report.pdf")}>Export PDF</button></div>
            </div>
          </div>
          <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <table>
              <thead><tr><th>Date</th><th>Occupied</th><th>Total</th><th>Occ %</th><th>ADR</th><th>RevPAR</th></tr></thead>
              <tbody>
                {occPaged.slice.map((row, i) => (
                  <tr key={String(row.date ?? i)}>
                    <td>{String(row.date ?? "")}</td>
                    <td>{String(row.occupiedRooms ?? "")}</td>
                    <td>{String(row.totalRooms ?? "")}</td>
                    <td>{String(row.occupancyRate ?? "")}</td>
                    <td>{String(row.adr ?? "")}</td>
                    <td>{String(row.revpar ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={occPage} totalPages={occPaged.totalPages} totalItems={occPaged.total} pageSize={OCC_PAGE} noun="days" onPageChange={setOccPage} />
          </div>
        </div>
      )}

      {tab === "guests" && guestAnalytics && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="hms-btn-outline text-sm" onClick={() => void exportFile(`/api/v1/hotels/${hotelId}/reports/guest-analytics/export?segment=RETURNING&tier=GOLD&minSpend=500&format=csv`, "guest-analytics-report.csv")}>Export CSV</button>
              <button type="button" className="hms-btn-outline text-sm" onClick={() => void exportFile(`/api/v1/hotels/${hotelId}/reports/guest-analytics/export?segment=RETURNING&tier=GOLD&minSpend=500&format=pdf`, "guest-analytics-report.pdf")}>Export PDF</button>
            </div>
          </div>
          <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h3 className="font-semibold mb-2">Insights</h3>
            <ul className="list-disc pl-6">
              {insPaged.slice.map((row, i) => <li key={i}>{Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" · ")}</li>)}
            </ul>
            <PaginationBar page={insPage} totalPages={insPaged.totalPages} totalItems={insPaged.total} pageSize={INSIGHT_PAGE} noun="insights" onPageChange={setInsPage} />
          </div>
          <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h3 className="font-semibold mb-2">Segments</h3>
            <ul className="list-disc pl-6">
              {segPaged.slice.map((row, i) => <li key={i}>{Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" · ")}</li>)}
            </ul>
            <PaginationBar page={segPage} totalPages={segPaged.totalPages} totalItems={segPaged.total} pageSize={SEG_PAGE} noun="segments" onPageChange={setSegPage} />
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-3">
          {(user?.role === "FINANCE" || user?.role === "MANAGER" || user?.role === "HOTEL_ADMIN") && (
            <button type="button" className="hms-btn-solid" onClick={() => setShowAuditConfirm(true)}>Run Night Audit</button>
          )}
          {auditMsg && <div className="panel">{auditMsg}</div>}
          <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <table>
              <thead><tr><th>Date</th><th>Rooms</th><th>Charges</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={`${a.run_date}-${a.run_at}`}>
                    <td>{a.run_date}</td><td>{a.rooms_audited}</td><td>{a.charges_posted}</td><td>{a.total_amount}</td><td>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAuditConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Run Night Audit?</h3>
            <p className="mt-2 text-sm text-muted-foreground">This will post nightly room charges for checked-in stays.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowAuditConfirm(false)} disabled={auditSubmitting}>Cancel</button>
              <button type="button" className="hms-btn-solid" onClick={() => void runNightAuditNow()} disabled={auditSubmitting}>{auditSubmitting ? "Running..." : "Confirm run"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
