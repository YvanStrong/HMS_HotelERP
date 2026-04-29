import Link from "next/link";
import { swaggerUiUrl } from "@/lib/api";

export default function SetupDocPage() {
  return (
    <div className="min-h-screen flex items-start justify-center pt-20 px-4 bg-gradient-to-br from-[hsl(40,33%,96%)] via-[hsl(30,20%,94%)] to-[hsl(31,28%,92%)]">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-card border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-8 sm:px-8 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">First-time Setup</h1>
                <p className="text-muted-foreground text-sm">Initialize your HMS environment</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Run the initialize request once per environment. It creates the platform admin, a sample hotel, and a hotel admin user.
            </p>

            <div className="bg-slate-50 rounded-xl border border-border/60 p-5">
              <h2 className="text-lg font-semibold mb-3">Setup Instructions</h2>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">1</span>
                  <span>Use <strong className="text-foreground">01 — Setup</strong> in your API collection</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">2</span>
                  <span>Send <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">POST /api/v1/setup/initialize</code></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">3</span>
                  <span>Include query <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">setupToken</code> or header <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">X-Setup-Token</code></span>
                </li>
              </ol>
              <p className="mt-4 text-sm text-muted-foreground">
                Token value: <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">hms.setup.token</code> (from backend config)
              </p>
            </div>

            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-800">
                Full API documentation available in{" "}
                <a href={swaggerUiUrl()} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                  Swagger UI
                </a>{" "}
                — no JWT needed for setup calls.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t">
              <Link href="/" className="hms-btn-outline">
                ← Home
              </Link>
              <Link href="/login" className="hms-btn-solid">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
