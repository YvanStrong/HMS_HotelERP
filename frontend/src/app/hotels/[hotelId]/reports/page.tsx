"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
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

const OCC_PAGE = 12;
const INSIGHT_PAGE = 8;
const SEG_PAGE = 8;

export default function HotelReportsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [guestAnalytics, setGuestAnalytics] = useState<GuestAnalyticsReport | null>(null);
  const [errOcc, setErrOcc] = useState<string | null>(null);
  const [errGa, setErrGa] = useState<string | null>(null);
  const [occPage, setOccPage] = useState(1);
  const [insPage, setInsPage] = useState(1);
  const [segPage, setSegPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const { start, end } = monthRange();
    (async () => {
      if (!getToken()) {
        setErrOcc("Not signed in.");
        setErrGa("Not signed in.");
        return;
      }
      try {
        const o = await apiFetch<OccupancyReport>(
          `/api/v1/hotels/${hotelId}/reports/occupancy?startDate=${start}&endDate=${end}&groupBy=day`,
        );
        if (!cancelled) {
          setOccupancy(o);
          setOccPage(1);
        }
      } catch (e) {
        if (!cancelled) setErrOcc(e instanceof Error ? e.message : "Failed");
      }
      try {
        const g = await apiFetch<GuestAnalyticsReport>(
          `/api/v1/hotels/${hotelId}/reports/guest-analytics?segment=RETURNING&tier=GOLD&minSpend=500`,
        );
        if (!cancelled) {
          setGuestAnalytics(g);
          setInsPage(1);
          setSegPage(1);
        }
      } catch (e) {
        if (!cancelled) setErrGa(e instanceof Error ? e.message : "Failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  const occRows = occupancy?.data ?? [];
  const occPaged = useMemo(() => paginateSlice(occRows, occPage, OCC_PAGE), [occRows, occPage]);

  const insights = guestAnalytics?.insights ?? [];
  const insPaged = useMemo(() => paginateSlice(insights, insPage, INSIGHT_PAGE), [insights, insPage]);

  const segments = guestAnalytics?.segments ?? [];
  const segPaged = useMemo(() => paginateSlice(segments, segPage, SEG_PAGE), [segments, segPage]);

  return (
    <>
      <h1>Reports</h1>
      <p style={{ color: "var(--muted)" }}>Occupancy and guest analytics for the selected period and filters.</p>
      <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Occupancy</h2>
      {errOcc && <div className="error panel">{errOcc}</div>}
      {occupancy != null && (
        <>
          <KeyValueTable title="Summary" rows={recordToRows(occupancy.summary)} />
          <div className="panel">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Daily rows</h2>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Occupied</th>
                    <th>Total</th>
                    <th>Occ %</th>
                    <th>ADR</th>
                    <th>RevPAR</th>
                  </tr>
                </thead>
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
            </div>
            <PaginationBar
              page={occPage}
              totalPages={occPaged.totalPages}
              totalItems={occPaged.total}
              pageSize={OCC_PAGE}
              noun="days"
              onPageChange={setOccPage}
            />
          </div>
        </>
      )}
      <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Guest analytics</h2>
      {errGa && <div className="error panel">{errGa}</div>}
      {guestAnalytics != null && (
        <>
          <KeyValueTable title="Filters" rows={recordToRows(guestAnalytics.filters)} />
          <KeyValueTable title="Summary" rows={recordToRows(guestAnalytics.summary)} />
          {insights.length > 0 && (
            <div className="panel">
              <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Insights</h2>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {insPaged.slice.map((row, i) => (
                  <li key={i} style={{ marginBottom: "0.35rem", fontSize: "0.9rem" }}>
                    {Object.entries(row)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
              <PaginationBar
                page={insPage}
                totalPages={insPaged.totalPages}
                totalItems={insPaged.total}
                pageSize={INSIGHT_PAGE}
                noun="insights"
                onPageChange={setInsPage}
              />
            </div>
          )}
          {segments.length > 0 && (
            <div className="panel">
              <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Segments</h2>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {segPaged.slice.map((row, i) => (
                  <li key={i} style={{ marginBottom: "0.35rem", fontSize: "0.9rem" }}>
                    {Object.entries(row)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
              <PaginationBar
                page={segPage}
                totalPages={segPaged.totalPages}
                totalItems={segPaged.total}
                pageSize={SEG_PAGE}
                noun="segments"
                onPageChange={setSegPage}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
