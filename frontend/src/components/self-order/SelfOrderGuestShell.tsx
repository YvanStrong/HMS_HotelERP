"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  SELF_ORDER_GUEST_NAV,
  buildGuestSelfOrderHref,
  guestNavActivePath,
  type GuestOrderQuery,
} from "@/lib/selfOrderGuestNav";
import { useSelfOrderGuestMeta } from "@/components/self-order/SelfOrderGuestMetaContext";

export function SelfOrderGuestShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const { hotelName, loading, error } = useSelfOrderGuestMeta();

  const query: GuestOrderQuery = useMemo(
    () => ({
      table: searchParams.get("table"),
      key: searchParams.get("key"),
    }),
    [searchParams],
  );

  const subtitle = useMemo(() => {
    const t = query.table?.trim();
    const venue = hotelName || "Restaurant";
    return t ? `Table ${t} · ${venue}` : `Guest order · ${venue}`;
  }, [query.table, hotelName]);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[15px] leading-snug">
      <aside className="lg:w-48 xl:w-52 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 lg:min-h-[100dvh] flex flex-col bg-zinc-950/98 lg:sticky lg:top-0 lg:self-start z-20">
        <div className="p-2 sm:p-3 lg:p-4 border-b border-zinc-800/80">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-zinc-500 leading-relaxed">{subtitle}</p>
        </div>
        <nav className="flex lg:flex-col gap-0.5 p-1.5 sm:p-2 overflow-x-auto lg:overflow-x-visible no-scrollbar">
          {SELF_ORDER_GUEST_NAV.map((def) => {
            const href = buildGuestSelfOrderHref(hotelId, def.segment, query);
            const active = guestNavActivePath(pathname, hotelId, def.segment);
            return (
              <Link
                key={def.id}
                href={href}
                className={`shrink-0 lg:w-full rounded-md lg:rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap lg:whitespace-normal ${
                  active ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800/90"
                }`}
              >
                {def.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden lg:block flex-1 min-h-0" />
        <div className="hidden lg:block p-2 sm:p-3 border-t border-zinc-800 text-[10px] text-zinc-600 space-y-1.5">
          <Link href="/book/hotels" className="block hover:text-zinc-400 underline">
            All hotels
          </Link>
          <Link href={buildGuestSelfOrderHref(hotelId, "pickup", query)} className="block hover:text-zinc-400 underline">
            Pickup board (lobby TV)
          </Link>
          <Link
            href={`/book/order/${hotelId}/screen${query.key?.trim() ? `?key=${encodeURIComponent(query.key.trim())}` : ""}`}
            className="block hover:text-zinc-400 underline"
          >
            Full-screen KDS
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-x-hidden">
        {loading && (
          <div className="p-4 sm:p-6 text-zinc-500 text-xs sm:text-sm">Loading menu…</div>
        )}
        {!loading && error && (
          <div className="p-6 space-y-3">
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-red-100 text-sm">{error}</div>
            <Link href="/book/hotels" className="text-sm text-zinc-400 hover:text-white underline">
              ← Hotels
            </Link>
          </div>
        )}
        {!loading && !error && <div className="flex-1 flex flex-col">{children}</div>}
      </div>

      <footer className="lg:hidden py-3 text-center text-[11px] text-zinc-600 border-t border-zinc-900 px-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Link href="/book/hotels" className="hover:text-zinc-400 underline">
          Hotels
        </Link>
        <span className="text-zinc-700">·</span>
        <Link href={buildGuestSelfOrderHref(hotelId, "pickup", query)} className="hover:text-zinc-400 underline">
          Pickup board
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href={`/book/order/${hotelId}/screen${query.key ? `?key=${encodeURIComponent(query.key.trim()!)}` : ""}`}
          className="hover:text-zinc-400 underline"
        >
          Full-screen KDS
        </Link>
      </footer>
    </div>
  );
}
