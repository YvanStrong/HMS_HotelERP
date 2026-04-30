"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QueryProvider } from "@/components/QueryProvider";
import { RoomStatusBadge } from "@/components/RoomStatusBadge";
import { clearToken, swaggerUiUrl, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { loadAuthUser } from "@/lib/auth";
import { canAccessHotelNav, navHint, type HotelNavKey } from "@/lib/hotelNavAccess";
import { staffAppPath } from "@/lib/staffAppRoutes";

const ROOM_STATUS_LEGEND = [
  "OCCUPIED",
  "VACANT_CLEAN",
  "VACANT_DIRTY",
  "INSPECTED",
  "BLOCKED",
  "OUT_OF_ORDER",
  "UNDER_MAINTENANCE",
  "RESERVED",
] as const;

type NavItem = { key: HotelNavKey; segment: string; label: string; icon: string };
type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { key: "dashboard", segment: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
      { key: "reports", segment: "reports", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ]
  },
  {
    title: "Rooms",
    items: [
      { key: "roomTypes", segment: "room-types", label: "Room Types", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { key: "rooms", segment: "rooms", label: "Rooms", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { key: "roomBlocks", segment: "room-blocks", label: "Room Blocks", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    ]
  },
  {
    title: "Guests & Bookings",
    items: [
      { key: "reservations", segment: "reservations", label: "Reservations", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
      { key: "invoices", segment: "invoices", label: "Invoices", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { key: "guests", segment: "guests", label: "Guests", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
      { key: "housekeeping", segment: "housekeeping", label: "Housekeeping", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
      {
        key: "hkMyTasks",
        segment: "housekeeping/my-tasks",
        label: "My HK tasks",
        icon: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
      },
    ]
  },
  {
    title: "Services",
    items: [
      { key: "facilities", segment: "facilities", label: "Facilities", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
      { key: "inventory", segment: "inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
      { key: "fb", segment: "fb", label: "F&B", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
    ]
  },
  {
    title: "Administration",
    items: [
      { key: "staff", segment: "staff", label: "Staff", icon: "M17 20h5V9H2v11h5m10 0v-7.5A2.5 2.5 0 0014.5 10h-5A2.5 2.5 0 007 12.5V20m10 0H7m6-13a3 3 0 110-6 3 3 0 010 6z" },
      { key: "settings", segment: "settings", label: "Settings", icon: "M10.325 4.317a1 1 0 011.35-.936l1.07.425a1 1 0 001.07-.188l.829-.83a1 1 0 011.414 0l1.414 1.414a1 1 0 010 1.414l-.83.829a1 1 0 00-.188 1.07l.425 1.07a1 1 0 01-.936 1.35h-1.173a1 1 0 00-.948.684l-.363 1.09a1 1 0 01-.95.684h-2a1 1 0 01-.95-.684l-.363-1.09a1 1 0 00-.948-.684H6.055a1 1 0 01-.936-1.35l.425-1.07a1 1 0 00-.188-1.07l-.83-.829a1 1 0 010-1.414L5.94 2.788a1 1 0 011.414 0l.829.83a1 1 0 001.07.188l1.07-.425zM12 15a3 3 0 100-6 3 3 0 000 6z" },
    ],
  },
];

export function HotelStaffShell({
  hotelId,
  children,
}: {
  hotelId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hotelName, setHotelName] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Overview",
    "Rooms",
    "Guests & Bookings",
    "Services",
    "Administration",
  ]);

  useEffect(() => {
    setUser(loadAuthUser());
  }, []);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => 
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const isSectionExpanded = (title: string) => expandedSections.includes(title);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hotels = await apiFetch<{ id: string; name: string }[]>("/api/v1/public/hotels");
        const hotel = hotels.find((h) => h.id === hotelId);
        if (!cancelled && hotel) setHotelName(hotel.name);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <QueryProvider>
    <div className="min-h-screen bg-gradient-to-br from-[hsl(40,33%,97%)] to-[hsl(31,24%,93%)] flex">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-sm border-r border-border transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo area */}
          <div className="p-4 border-b border-border">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="font-bold text-lg text-foreground">HMS</span>
            </Link>
          </div>

          {/* Hotel info */}
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Hotel</p>
            <p className="font-medium text-foreground truncate">{hotelName || hotelId.slice(0, 8) + "…"}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1 scrollbar-thin">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="mb-2">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{section.title}</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${isSectionExpanded(section.title) ? "rotate-180" : ""}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isSectionExpanded(section.title) && (
                  <div className="space-y-1 mt-1">
                    {section.items.map((item) => {
                      const href = staffAppPath(item.segment);
                      const active =
                        item.segment === "dashboard"
                          ? pathname === "/app" || pathname === "/app/dashboard"
                          : pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
                      const allowed = canAccessHotelNav(user, item.key);
                      return (
                        <Link
                          key={item.segment}
                          href={href}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          } ${!allowed ? "opacity-50 cursor-not-allowed" : ""}`}
                          title={allowed ? item.label : `Requires access — ${navHint(item.key)}`}
                        >
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                          <span className="truncate">{item.label}</span>
                          {!allowed && (
                            <svg className="w-4 h-4 ml-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">{user?.username?.charAt(0).toUpperCase() || "U"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.username || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.role || "HOTEL_ADMIN"}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </Link>
              <a href={swaggerUiUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                API Docs
              </a>
              <div className="pt-2 border-t border-border/60 mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Room status</p>
                <div className="flex flex-wrap gap-1">
                  {ROOM_STATUS_LEGEND.map((s) => (
                    <RoomStatusBadge key={s} status={s} />
                  ))}
                </div>
              </div>
              {user && (
                <button type="button" onClick={logout} className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-foreground">{hotelName || "Hotel"}</span>
          <div className="w-8" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
    </QueryProvider>
  );
}
