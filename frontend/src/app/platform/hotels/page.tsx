"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiFetch, getToken } from "@/lib/api";
import { isSuperAdmin, loadAuthUser } from "@/lib/auth";
import { publicFetch } from "@/lib/publicApi";
import { PaginationBar } from "@/components/PaginationBar";
import { paginateSlice } from "@/lib/pagination";

type Hotel = {
  id: string;
  name: string;
  code: string;
  currency: string;
  timezone?: string;
  address?: string;
  phone?: string;
  email?: string;
  imageUrl?: string;
  logoUrl?: string;
  starRating?: number;
  isActive: boolean;
  createdAt?: string;
};

const PAGE_SIZE = 9;

export default function PlatformHotelsPage() {
  const [hotels, setHotels] = useState<Hotel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Hotel | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState("");
  const [singleDeletePurge, setSingleDeletePurge] = useState(false);
  const [bulkDeletePurge, setBulkDeletePurge] = useState(false);
  const [platformSuperAdmin, setPlatformSuperAdmin] = useState(false);

  useEffect(() => {
    setPlatformSuperAdmin(isSuperAdmin(loadAuthUser()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      try {
        // Use public API to list hotels (platform API doesn't support GET /hotels)
        const data = await publicFetch<Hotel[]>("/api/v1/public/hotels");
        if (!cancelled) {
          setHotels(data);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load hotels");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
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
        (h.address && h.address.toLowerCase().includes(q))
    );
  }, [hotels, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setSelectedHotelIds((prev) => prev.filter((id) => filtered.some((h) => h.id === id)));
  }, [filtered]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(filtered, page, PAGE_SIZE),
    [filtered, page]
  );

  const totalHotels = hotels?.length ?? 0;
  const activeHotels = hotels?.filter((h) => h.isActive).length ?? 0;
  const inactiveHotels = totalHotels - activeHotels;
  const uniqueCurrencies = useMemo(
    () => new Set((hotels ?? []).map((h) => h.currency).filter(Boolean)).size,
    [hotels],
  );

  async function deleteHotel(hotelId: string, hotelName: string, purge = false): Promise<boolean> {
    setBusyDeleteId(hotelId);
    try {
      await apiFetch(`/api/v1/platform/hotels/${hotelId}?purge=${purge}`, {
        method: "DELETE",
      });
      setHotels((prev) => prev?.filter((h) => h.id !== hotelId) ?? null);
      setPendingDelete(null);
      setDeleteConfirmName("");
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete hotel";
      if (message.includes("404") || message.includes("Not Found")) {
        setError("Delete API is not implemented on backend. Use platform API/database operations for deletion.");
        return false;
      }
      if (message.startsWith("Cannot delete this hotel")) {
        setError(
          `${hotelName}: ${message} Use "Force purge dependent data" for irreversible deletion.`,
        );
        return false;
      }
      setError(message);
      return false;
    } finally {
      setBusyDeleteId((current) => (current === hotelId ? null : current));
    }
  }

  async function bulkDeleteSelected() {
    if (selectedHotelIds.length === 0) return;
    const failed: string[] = [];
    for (const hotelId of selectedHotelIds) {
      const hotel = hotels?.find((h) => h.id === hotelId);
      if (!hotel) continue;
      const ok = await deleteHotel(hotel.id, hotel.name, bulkDeletePurge);
      if (!ok) failed.push(hotel.name);
    }
    if (failed.length === 0) {
      setSelectedHotelIds([]);
      setBulkDeleteOpen(false);
      setBulkDeleteConfirm("");
      setBulkDeletePurge(false);
      return;
    }
    setError(`Failed to delete ${failed.length} hotel(s): ${failed.join(", ")}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hotel Management</h1>
          <p className="text-muted-foreground mt-1">
            View, create, and manage all hotel properties on the platform
          </p>
        </div>
        <Link
          href="/platform/hotels/new"
          className="hms-btn-solid hms-btn-sm hms-btn-icon"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Hotel
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total properties</p>
          <p className="mt-2 text-2xl font-semibold">{totalHotels}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{activeHotels}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Inactive</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{inactiveHotels}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Currencies in use</p>
          <p className="mt-2 text-2xl font-semibold">{uniqueCurrencies}</p>
        </div>
      </div>

      <section className="hms-section-card">
        <div className="hms-section-head">
          <h2 className="hms-section-title">Search Hotels</h2>
          <p className="hms-section-sub">Find by property name, code, currency, or address.</p>
        </div>
        {platformSuperAdmin && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="hms-btn-outline hms-btn-sm"
              onClick={() =>
                setSelectedHotelIds((prev) => {
                  const allVisible = slice.map((h) => h.id);
                  const everySelected = allVisible.every((id) => prev.includes(id));
                  return everySelected
                    ? prev.filter((id) => !allVisible.includes(id))
                    : Array.from(new Set([...prev, ...allVisible]));
                })
              }
            >
              {slice.every((h) => selectedHotelIds.includes(h.id)) ? "Clear page selection" : "Select page"}
            </button>
            <button
              type="button"
              className="hms-btn-outline hms-btn-sm text-red-700 border-red-300 hover:bg-red-50"
              disabled={selectedHotelIds.length === 0}
              onClick={() => {
                setBulkDeleteOpen(true);
                setBulkDeleteConfirm("");
                setBulkDeletePurge(false);
              }}
            >
              Delete selected ({selectedHotelIds.length})
            </button>
          </div>
        )}
        <div className="max-w-md">
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
            placeholder="Search hotels by name, code, or address..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5"
          />
        </div>
        {hotels != null && (
          <p className="text-sm text-muted-foreground mt-2">
            Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
            <strong className="text-foreground">{hotels.length}</strong> hotels
          </p>
        )}
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border/60 p-4 animate-pulse">
              <div className="h-40 bg-muted rounded-lg mb-4" />
              <div className="h-6 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Hotels Grid */}
      {!loading && hotels && (
        <>
          {slice.length === 0 ? (
            <div className="text-center py-12 bg-muted/50 rounded-xl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No hotels found</h3>
              <p className="text-muted-foreground mb-4">
                {query ? "Try adjusting your search" : "Get started by creating your first hotel"}
              </p>
              {!query && (
                <Link href="/platform/hotels/new" className="hms-btn-solid hms-btn-sm">
                  Create Hotel
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {slice.map((hotel) => (
                <div
                  key={hotel.id}
                  className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-soft hover:shadow-float hover:border-primary/30 transition-all group"
                >
                  {platformSuperAdmin && (
                    <div className="px-4 pt-4">
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={selectedHotelIds.includes(hotel.id)}
                          onChange={(e) =>
                            setSelectedHotelIds((prev) =>
                              e.target.checked
                                ? Array.from(new Set([...prev, hotel.id]))
                                : prev.filter((id) => id !== hotel.id),
                            )
                          }
                        />
                        Select property
                      </label>
                    </div>
                  )}
                  {/* Image */}
                  <div className="relative h-48 bg-muted">
                    {hotel.imageUrl ? (
                      hotel.imageUrl.startsWith("data:") ? (
                        <img
                          src={hotel.imageUrl}
                          alt={hotel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Image
                          src={hotel.imageUrl}
                          alt={hotel.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(40 22% 93%) 0%, hsl(30 18% 88%) 100%)" }}>
                        {hotel.logoUrl ? (
                          hotel.logoUrl.startsWith("data:") ? (
                            <img
                              src={hotel.logoUrl}
                              alt={`${hotel.name} logo`}
                              className="w-20 h-20 object-contain"
                            />
                          ) : (
                            <Image
                              src={hotel.logoUrl}
                              alt={`${hotel.name} logo`}
                              width={80}
                              height={80}
                              unoptimized
                              className="object-contain"
                            />
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-2">
                              <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                            <span className="text-sm text-foreground font-medium">{hotel.name}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          hotel.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {hotel.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {/* Logo overlay */}
                    {hotel.logoUrl && hotel.imageUrl && (
                      <div className="absolute bottom-3 left-3 w-12 h-12 bg-white rounded-lg shadow-md p-1">
                        <Image
                          src={hotel.logoUrl}
                          alt={`${hotel.name} logo`}
                          width={40}
                          height={40}
                          className="object-contain w-full h-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {hotel.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{hotel.code}</p>
                      </div>
                      {hotel.starRating && (
                        <div className="flex items-center gap-0.5 text-amber-500">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm font-medium">{hotel.starRating}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground mb-4">
                      {hotel.address && (
                        <p className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{hotel.address}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {hotel.currency}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Link
                        href={`/platform/hotels/${hotel.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </Link>
                      <Link
                        href={`/platform/hotels/${hotel.id}/edit`}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
                        title="Edit"
                        aria-label={`Edit ${hotel.name}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      {platformSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDelete(hotel);
                            setDeleteConfirmName("");
                            setSingleDeletePurge(false);
                            setError(null);
                          }}
                          disabled={busyDeleteId === hotel.id}
                          className="inline-flex items-center justify-center p-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Delete"
                          aria-label={`Delete ${hotel.name}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-float">
            <h3 className="text-lg font-semibold">Delete property</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This action removes <strong className="text-foreground">{pendingDelete.name}</strong>. Type the hotel name to confirm.
            </p>
            <div className="mt-4">
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={pendingDelete.name}
              />
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={singleDeletePurge}
                onChange={(e) => setSingleDeletePurge(e.target.checked)}
              />
              Force purge dependent hotel data (irreversible)
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="hms-btn-outline"
                onClick={() => {
                  if (busyDeleteId) return;
                  setPendingDelete(null);
                  setDeleteConfirmName("");
                  setSingleDeletePurge(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid bg-red-600 hover:bg-red-700"
                disabled={deleteConfirmName.trim() !== pendingDelete.name || busyDeleteId === pendingDelete.id}
                onClick={() => deleteHotel(pendingDelete.id, pendingDelete.name, singleDeletePurge)}
              >
                {busyDeleteId === pendingDelete.id ? "Deleting..." : "Delete hotel"}
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-float">
            <h3 className="text-lg font-semibold">Bulk delete properties</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You are deleting <strong className="text-foreground">{selectedHotelIds.length}</strong> selected properties. Type{" "}
              <strong className="text-foreground">DELETE</strong> to continue.
            </p>
            <div className="mt-4">
              <input
                type="text"
                value={bulkDeleteConfirm}
                onChange={(e) => setBulkDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
              />
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={bulkDeletePurge}
                onChange={(e) => setBulkDeletePurge(e.target.checked)}
              />
              Force purge dependent data for each selected hotel (irreversible)
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="hms-btn-outline"
                onClick={() => {
                  setBulkDeleteOpen(false);
                  setBulkDeleteConfirm("");
                  setBulkDeletePurge(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid bg-red-600 hover:bg-red-700"
                disabled={bulkDeleteConfirm.trim() !== "DELETE" || !!busyDeleteId}
                onClick={bulkDeleteSelected}
              >
                {busyDeleteId ? "Deleting..." : "Delete selected"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
