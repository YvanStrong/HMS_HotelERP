"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { loadAuthUser } from "@/lib/auth";
import { canAccessHotelNav, navHint, type HotelNavKey } from "@/lib/hotelNavAccess";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { useHotelContext } from "@/lib/useHotelContext";
import { PosOrderToastHost } from "@/components/PosOrderToastHost";
import { StaffNotificationBell } from "@/components/StaffNotificationBell";
import { ModuleDisabledPage } from "@/components/ModuleDisabledPage";
import { ReportBugButton } from "@/components/ReportBugButton";

type NavItem = {
  key: HotelNavKey;
  segment: string;
  label: string;
  icon: string;
  /** Public guest URLs (not under /app); open in new tab. */
  publicTarget?: "guest_self_order" | "guest_kitchen_screen";
};
type NavSection = { title: string; items: NavItem[] };

const NAV_MODULES: Partial<Record<HotelNavKey, string>> = {
  dashboard: "DASHBOARD",
  accounting: "ACCOUNTING",
  roomTypes: "ROOM_TYPES",
  rooms: "ROOMS",
  roomBlocks: "ROOM_BLOCKS",
  reservations: "PMS",
  groups: "GROUPS_EVENTS",
  invoices: "INVOICES",
  guests: "GUESTS",
  staff: "STAFF",
  housekeeping: "HOUSEKEEPING",
  hkMyTasks: "HK_MY_TASKS",
  facilities: "FACILITIES",
  pos: "RESTAURANT_POS",
  selfOrders: "SELF_ORDERS",
  inventory: "INVENTORY",
  pricing: "PRICING",
  channels: "REVENUE_CHANNELS",
  iot: "IOT_SMART_ROOM",
  auditLogs: "AUDIT_LOGS",
  serviceRequests: "SERVICE_REQUESTS",
  settings: "SETTINGS",
  hr: "HR",
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { key: "dashboard", segment: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
      { key: "accounting", segment: "accounting", label: "Accounting", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12v-2m8-4a8 8 0 11-16 0 8 8 0 0116 0z" },
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
      { key: "groups", segment: "groups", label: "Groups & Events", icon: "M17 20h5V4H2v16h5m10 0v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5m10 0H7m8-12h.01M9 8h.01" },
      { key: "invoices", segment: "invoices", label: "Invoices", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { key: "guests", segment: "guests", label: "Guests", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
      { key: "staff", segment: "staff", label: "Staff", icon: "M17 20h5V4H2v16h5m10 0v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5m10 0H7m8-12h.01M9 8h.01" },
      { key: "housekeeping", segment: "housekeeping", label: "Housekeeping", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
      {
        key: "hkMyTasks",
        segment: "housekeeping/my-tasks",
        label: "My HK tasks",
        icon: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
      },
      { key: "serviceRequests", segment: "service-requests", label: "Service Requests", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
    ]
  },
  {
    title: "Services",
    items: [
      { key: "facilities", segment: "facilities", label: "Facilities", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
      {
        key: "pos",
        segment: "pos",
        label: "POS",
        icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
      },
      {
        key: "selfOrders",
        segment: "self-orders",
        label: "Self orders",
        icon: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
      },
      { key: "inventory", segment: "inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
      { key: "pricing", segment: "pricing", label: "Pricing", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { key: "channels", segment: "channels", label: "Channels", icon: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" },
    ]
  },
  {
    title: "Administration",
    items: [
      { key: "staff", segment: "staff", label: "Staff", icon: "M17 20h5V9H2v11h5m10 0v-7.5A2.5 2.5 0 0014.5 10h-5A2.5 2.5 0 007 12.5V20m10 0H7m6-13a3 3 0 110-6 3 3 0 010 6z" },
      { key: "hr", segment: "hr", label: "HR", icon: "M17 20h5V9H2v11h5m10 0v-7.5A2.5 2.5 0 0014.5 10h-5A2.5 2.5 0 007 12.5V20m10 0H7M12 3a3 3 0 110 6 3 3 0 010-6zm-7 9a7 7 0 0114 0H5z" },
      { key: "iot", segment: "iot", label: "IoT & Smart Room", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0114 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
      { key: "auditLogs", segment: "audit-logs", label: "Audit Logs", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { key: "subscription", segment: "subscription", label: "Subscription", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12v-2m8-4a8 8 0 11-16 0 8 8 0 0116 0z" },
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
  const isPosWorkspace = pathname === staffAppPath("pos") || /\/pos$/.test(pathname ?? "");
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const { hotel, hasModule, isModuleVisibleWhenDisabled, entitlementsLoaded, loading: hotelLoading } =
    useHotelContext(hotelId);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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

  function logout() {
    clearToken();
    router.push("/login");
  }

  const currentNavItem = NAV_SECTIONS.flatMap((section) => section.items).find((item) => {
    const href = staffAppPath(item.segment);
    return item.segment === "dashboard"
      ? pathname === "/app" || pathname === "/app/dashboard" || pathname.endsWith("/dashboard")
      : pathname === href || pathname?.startsWith(`${href}/`) || pathname?.includes(`/${item.segment}`);
  });
  const currentModuleKey = currentNavItem ? NAV_MODULES[currentNavItem.key] : null;
  const currentModuleDisabled = Boolean(
    entitlementsLoaded && currentModuleKey && !hasModule(currentModuleKey),
  );

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[hsl(204,94%,98%)] to-[hsl(38,92%,94%)] flex">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 h-screen bg-white/97 backdrop-blur-sm border-r border-border/80 shadow-[2px_0_16px_rgba(26,58,92,0.08)] transform transition-all duration-200 ease-in-out ${
          isSidebarCollapsed ? "lg:w-20" : "lg:w-72"
        } w-72 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Brand + Hotel area */}
          <div className="relative p-4 border-b border-border/70" style={{ background: "linear-gradient(to bottom right, hsl(0 0% 100%), hsl(204 94% 97%))" }}>
            <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-end"}`}>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="absolute right-4 top-4 hidden h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-white text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground lg:inline-flex"
                aria-label={isSidebarCollapsed ? "Expand menu" : "Collapse menu"}
                title={isSidebarCollapsed ? "Expand menu" : "Collapse menu"}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-white text-muted-foreground shadow-sm"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2.5 rounded-xl bg-white/70 p-2 pr-14">
                {hotel.logoUrl ? (
                  <img
                    src={hotel.logoUrl}
                    alt={`${hotel.name} logo`}
                    className="w-9 h-9 rounded-lg object-cover border border-border/60 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm" style={{ background: "hsl(var(--primary))" }}>
                    {(hotel.name || "H").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{hotelLoading ? "Loading…" : hotel.name}</p>
                  <p className="text-[11px] text-muted-foreground">Active hotel</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-2 space-y-1 scrollbar-thin ${isSidebarCollapsed ? "px-2" : "px-3"}`}>
            {NAV_SECTIONS.map((section) => {
              const visibleItems = section.items.filter((item) => {
                const moduleKey = NAV_MODULES[item.key];
                return !moduleKey || hasModule(moduleKey) || isModuleVisibleWhenDisabled(moduleKey);
              });
              if (visibleItems.length === 0) return null;
              return (
              <div key={section.title} className="mb-2">
                {!isSidebarCollapsed && (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors bg-transparent shadow-none rounded-none border-none"
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
                )}
                {(isSidebarCollapsed || isSectionExpanded(section.title)) && (
                  <div className="space-y-1 mt-1">
                    {visibleItems.map((item) => {
                      const moduleKey = NAV_MODULES[item.key];
                      const moduleEnabled = !moduleKey || hasModule(moduleKey);
                      const canSeeDisabled = Boolean(moduleKey && isModuleVisibleWhenDisabled(moduleKey));
                      if (!moduleEnabled && !canSeeDisabled) {
                        return null;
                      }
                      const publicHref =
                        item.publicTarget === "guest_self_order"
                          ? `/book/order/${hotelId}`
                          : item.publicTarget === "guest_kitchen_screen"
                            ? `/book/order/${hotelId}/screen`
                            : null;
                      const href = publicHref ?? staffAppPath(item.segment);
                      const active = publicHref
                        ? false
                        : item.segment === "dashboard"
                          ? pathname === "/app" || pathname === "/app/dashboard"
                          : pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
                      const roleAllowed = canAccessHotelNav(user, item.key);
                      const allowed = roleAllowed && moduleEnabled;
                      const className = `flex items-center rounded-lg text-sm font-medium transition-colors ${
                        isSidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
                      } ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      } ${!allowed ? "opacity-50 cursor-not-allowed" : ""}`;
                      const title = allowed
                        ? item.label
                        : !moduleEnabled
                          ? "Contact your administrator to enable this feature"
                          : `Requires access — ${navHint(item.key)}`;
                      const inner = (
                        <>
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                          {!isSidebarCollapsed && !moduleEnabled ? (
                            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                              Locked
                            </span>
                          ) : !allowed && !isSidebarCollapsed && (
                            <svg className="w-4 h-4 ml-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </>
                      );
                      if (publicHref) {
                        if (!allowed) {
                          return (
                            <span key={item.segment} className={className} title={title}>
                              {inner}
                            </span>
                          );
                        }
                        return (
                          <a
                            key={item.segment}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setIsSidebarOpen(false)}
                            className={className}
                            title={title}
                          >
                            {inner}
                          </a>
                        );
                      }
                      if (!allowed) {
                        return (
                          <span key={item.segment} className={className} title={title}>
                            {inner}
                          </span>
                        );
                      }
                      return (
                        <Link
                          key={item.segment}
                          href={href}
                          prefetch={allowed}
                          onPointerEnter={() => {
                            if (allowed) router.prefetch(href);
                          }}
                          onClick={() => setIsSidebarOpen(false)}
                          className={className}
                          title={title}
                        >
                          {inner}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-border/70">
            <div className={`flex items-center rounded-lg ${isSidebarCollapsed ? "justify-center px-0 py-1.5" : "gap-2.5 px-1 py-1.5"}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold shadow-sm" style={{ background: "hsl(var(--primary))" }}>
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </div>
              {!isSidebarCollapsed && <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">{user?.username || "User"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.role?.replace(/_/g, " ") || "HOTEL ADMIN"}</p>
              </div>}
            </div>
            {user && (
              <>
                <ReportBugButton variant="sidebar" collapsed={isSidebarCollapsed} />
                <button
                type="button"
                onClick={logout}
                className={`mt-1 w-full flex items-center rounded-lg text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors bg-transparent shadow-none border-none ${
                  isSidebarCollapsed ? "justify-center px-2 py-2" : "gap-2 px-2 py-2"
                }`}
                title="Sign out"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {!isSidebarCollapsed && "Sign out"}
              </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="fixed right-4 top-4 z-40">
          <StaffNotificationBell hotelId={hotelId} />
        </div>
        <PosOrderToastHost hotelId={hotelId} />

        {/* Mobile header */}
        <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-start gap-3 pr-16 lg:hidden">
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setIsSidebarCollapsed((prev) => !prev);
              } else {
                setIsSidebarOpen(true);
              }
            }}
            className="p-2 rounded-lg hover:bg-accent transition-colors bg-transparent shadow-none border-none"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-foreground">{hotelLoading ? "Loading..." : hotel.name}</span>
        </header>

        {/* Page content */}
        <main
          className={
            isPosWorkspace
              ? "flex-1 overflow-hidden p-4 pr-0 pb-4 pt-4 sm:p-6 sm:pr-0 sm:pb-6 sm:pt-6 lg:overflow-hidden lg:py-8 lg:pl-8 lg:pr-0"
              : "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          }
        >
          <div className={isPosWorkspace ? "h-full min-w-0 w-full max-w-none" : "mx-auto min-w-0 max-w-7xl"}>
            {currentModuleDisabled ? (
              <ModuleDisabledPage module={currentNavItem?.label ?? "This module"} />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}