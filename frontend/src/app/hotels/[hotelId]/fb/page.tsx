"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type Outlet = { id: string; name: string; code?: string; outletType?: string; allowsRoomCharge?: boolean };

const PAGE_SIZE = 10;

export default function FbPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<Outlet[] | null>(null);
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
        const json = await apiFetch<Outlet[]>(`/api/v1/hotels/${hotelId}/fb/outlets`);
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

  return (
    <>
      <h1>F&amp;B</h1>
      <p style={{ color: "var(--muted)" }}>Outlets, menus, and room-charge settings.</p>
      {error && <div className="error panel">{error}</div>}
      {rows && (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.code ?? "—"}</td>
                  <td>{r.outletType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            noun="outlets"
            onPageChange={setPage}
          />
        </div>
      )}
    </>
  );
}
