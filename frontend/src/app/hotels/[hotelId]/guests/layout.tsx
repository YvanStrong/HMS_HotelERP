"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { staffAppPath } from "@/lib/staffAppRoutes";

const LINKS = [
  { href: () => staffAppPath("guests"), label: "Directory", match: (p: string) => /\/guests\/?$/.test(p) },
  { href: () => staffAppPath("guests", "check-in"), label: "Check-in desk", match: (p: string) => p.includes("/guests/check-in") },
  { href: () => staffAppPath("guests", "in-house"), label: "In-house", match: (p: string) => p.includes("/guests/in-house") },
  { href: () => staffAppPath("guests", "checkout"), label: "Checkout desk", match: (p: string) => p.includes("/guests/checkout") },
  { href: () => staffAppPath("guests", "complaints"), label: "Complaint log", match: (p: string) => p.includes("/guests/complaints") },
] as const;

export default function GuestsModuleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
        {LINKS.map((item) => {
          const href = item.href();
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              href={href}
              className={
                active
                  ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                  : "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
