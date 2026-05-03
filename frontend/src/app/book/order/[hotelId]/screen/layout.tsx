import { Suspense } from "react";

export default function SelfOrderScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-lg">Loading…</div>
      }
    >
      {children}
    </Suspense>
  );
}
