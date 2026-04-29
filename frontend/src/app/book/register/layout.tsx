import { Suspense } from "react";

export default function BookRegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="panel book-register-intro" style={{ maxWidth: "min(640px, 100%)" }}>
          <p style={{ color: "var(--muted)", margin: 0 }}>Loading registration…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
