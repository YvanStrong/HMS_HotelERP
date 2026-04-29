"use client";

import { useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { HotelCard } from "@/components/HotelCard";
import { paginateSlice } from "@/lib/pagination";
import { publicFetch } from "@/lib/publicApi";

type PublicHotel = {
  id: string;
  name: string;
  code: string;
  currency: string;
  timezone: string;
  imageUrl?: string;
  logoUrl?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
};

const PAGE_SIZE = 9;

export default function BookHotelsCatalogPage() {
  const [hotels, setHotels] = useState<PublicHotel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await publicFetch<PublicHotel[]>("/api/v1/public/hotels");
        console.log("Hotels loaded:", data);
        if (!c) setHotels(data);
      } catch (e) {
        console.error("Failed to load hotels:", e);
        if (!c) setError(e instanceof Error ? e.message : "Failed to load hotels");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!hotels) return [];
    const q = query.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q) ||
        h.currency.toLowerCase().includes(q) ||
        (h.timezone && h.timezone.toLowerCase().includes(q)),
    );
  }, [hotels, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Browse All Hotels</h1>
        <p className="text-muted-foreground">
          Explore our curated collection of premium properties. Find your perfect stay with detailed photos, amenities, and instant availability.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto mb-8">
        <div className="relative">
          <svg 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search hotels by name, code, or location..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-white shadow-soft focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        {hotels != null && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            Showing <strong className="text-foreground">{filtered.length}</strong> of <strong className="text-foreground">{hotels.length}</strong> properties
          </p>
        )}
      </div>

      {error && <div className="error max-w-xl mx-auto mb-6">{error}</div>}

      {hotels && filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">No hotels found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms or browse all properties</p>
          <button 
            onClick={() => setQuery("")}
            className="mt-4 hms-btn-outline"
          >
            Clear Search
          </button>
        </div>
      )}

      {hotels && filtered.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {slice.map((h) => (
              <HotelCard
                key={h.id}
                id={h.id}
                name={h.name}
                code={h.code}
                currency={h.currency}
                timezone={h.timezone}
                imageUrl={h.imageUrl}
                description={h.description}
                rating={h.rating}
                reviewCount={h.reviewCount}
              />
            ))}
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            noun="hotels"
            onPageChange={setPage}
          />
        </>
      )}

      {/* Debug Toggle */}
      <div className="mt-8 pt-8 border-t">
        <button
          onClick={() => setDebug(!debug)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {debug ? "Hide Debug Info" : "Show Debug Info"}
        </button>
        {debug && hotels && (
          <div className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-lg overflow-auto max-h-96 text-xs font-mono">
            <p className="text-slate-400 mb-2">Raw hotel data from API:</p>
            {hotels.map(h => (
              <div key={h.id} className="mb-4 pb-4 border-b border-slate-700">
                <p><span className="text-yellow-400">{h.name}</span> ({h.id})</p>
                <p className="text-slate-400">imageUrl: {h.imageUrl ? `"${h.imageUrl.slice(0, 50)}..."` : "undefined"}</p>
                <p className="text-slate-400">logoUrl: {h.logoUrl ? `"${h.logoUrl.slice(0, 50)}..."` : "undefined"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
