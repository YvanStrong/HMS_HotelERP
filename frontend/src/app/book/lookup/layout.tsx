import { Suspense } from "react";

export default function BookLookupLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p style={{ color: "var(--muted)" }}>Loading…</p>}>{children}</Suspense>;
}
