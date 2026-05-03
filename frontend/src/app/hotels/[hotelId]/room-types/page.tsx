"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";

type RoomTypeRow = {
  id: string;
  code?: string;
  name: string;
  baseRate: number;
  maxOccupancy?: number;
  bedCount?: number;
};

const PAGE_SIZE = 10;

export default function RoomTypesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<RoomTypeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        return;
      }
      try {
        const json = await apiFetch<RoomTypeRow[]>(`/api/v1/hotels/${hotelId}/room-types`);
        if (!cancelled) {
          setRows(json);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load room types");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(rows ?? [], page, PAGE_SIZE),
    [rows, page],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Room Types</h1>
          <p className="text-muted-foreground mt-1">
            Manage rates and capacity for each sellable room category
          </p>
        </div>
        <div className="flex items-center gap-3">
          {rows && (
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">{rows.length}</strong> room types
            </div>
          )}
          <button 
            onClick={() => (window.location.href = staffAppPath("room-types", "new"))}
            className="hms-btn-solid text-sm inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Room Type
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Room Type Cards */}
      {rows && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {slice.map((r) => (
              <div
                key={r.id}
                className="bg-card rounded-xl border border-border/60 p-5 shadow-soft hover:shadow-float transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{r.name}</h3>
                  <span className="text-lg font-bold text-primary">{r.baseRate}</span>
                </div>
                
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Max Occupancy</span>
                    <span className="font-medium">{r.maxOccupancy ?? "—"} guests</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bed Count</span>
                    <span className="font-medium">{r.bedCount ?? "—"}</span>
                  </div>
                </div>
                
                <Link
                  href={staffAppPath("room-types", r.id)}
                  className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Open Details
                </Link>
              </div>
            ))}
          </div>
          
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            noun="room types"
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
