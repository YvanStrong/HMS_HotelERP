"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type Facility = { id: string; name: string; code?: string; type?: string };

const PAGE_SIZE = 10;

export default function FacilitiesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<Facility[] | null>(null);
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
        const json = await apiFetch<Facility[]>(`/api/v1/hotels/${hotelId}/facilities`);
        if (!cancelled) {
          setRows(json);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
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

  const getFacilityIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case "spa": return "💆";
      case "gym": return "💪";
      case "pool": return "🏊";
      case "restaurant": return "🍽️";
      case "meeting_room": return "🤝";
      case "parking": return "🅿️";
      default: return "🏢";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facilities</h1>
          <p className="text-muted-foreground mt-1">Spa, gym, meeting rooms, and bookable assets</p>
        </div>
        {rows && (
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">{rows.length}</strong> facilities
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {rows && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slice.map((r) => (
              <div
                key={r.id}
                className="bg-card rounded-xl border border-border/60 p-5 shadow-soft hover:shadow-float transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    {getFacilityIcon(r.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{r.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {r.code && <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{r.code}</code>}
                      {r.type && <span className="capitalize">{r.type.replace(/_/g, " ")}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            noun="facilities"
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
