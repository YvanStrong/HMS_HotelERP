"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type ItemRow = {
  id: string;
  name: string;
  sku?: string;
  currentStock?: number;
  category?: string;
};
type ItemsPayload = { data?: ItemRow[]; summary?: unknown };

const PAGE_SIZE = 12;

export default function InventoryPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [payload, setPayload] = useState<ItemsPayload | null>(null);
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
        const json = await apiFetch<ItemsPayload>(
          `/api/v1/hotels/${hotelId}/inventory/items?lowStock=false`,
        );
        if (!cancelled) {
          setPayload(json);
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

  const items = payload?.data ?? [];
  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(items, page, PAGE_SIZE),
    [items, page],
  );

  return (
    <>
      <h1>Inventory</h1>
      <p style={{ color: "var(--muted)" }}>Stock list for this property. Suppliers and POs stay in Swagger.</p>
      {error && <div className="error panel">{error}</div>}
      {payload && (
        <div className="panel">
          <p style={{ color: "var(--muted)", marginTop: 0 }}>{items.length} item(s)</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.sku ?? "—"}</td>
                  <td>{r.currentStock ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            noun="items"
            onPageChange={setPage}
          />
        </div>
      )}
    </>
  );
}
