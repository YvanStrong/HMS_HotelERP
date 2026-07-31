"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { saveAuthSession, postLoginRedirectPath } from "@/lib/auth";
import { ThemeToggle } from "@/lib/theme";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordJustReset = searchParams.get("reset") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      saveAuthSession(data.accessToken, data.user);
      router.push(postLoginRedirectPath(data.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-svh max-h-svh flex flex-col overflow-hidden bg-gradient-to-br from-background via-card to-secondary/60 p-3 sm:p-4">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card md:flex-row">
        <aside className="relative hidden shrink-0 flex-col justify-center overflow-hidden bg-[#0f172a] px-8 py-8 text-white md:flex md:w-[40%] lg:px-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(14,165,233,.9) 0, transparent 42%), radial-gradient(circle at 80% 80%, rgba(245,158,11,.75) 0, transparent 38%)",
            }}
          />
          <div className="relative z-[1] flex flex-col gap-6">
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-sky-300/30">
              <img
                src="/images/kivu-cloud-solutions-logo.png"
                alt="Kivu Cloud Solutions"
                className="h-36 w-full object-contain"
              />
            </div>
            <p className="text-sm font-medium tracking-wide text-sky-200">
              Hotel Management System
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-slate-100/85">
              Secure staff access to reservations, room management, housekeeping, billing, and reporting.
            </p>
            <ul className="space-y-2 text-sm text-slate-100/85">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                Role-based access
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                Secure JWT session
              </li>
            </ul>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
              <div className="md:hidden">
                <img
                  src="/images/kivu-cloud-solutions-logo.png"
                  alt="Kivu Cloud Solutions"
                  className="h-16 w-auto max-w-[220px] object-contain"
                />
                <h1 className="mt-3 font-serif text-2xl font-semibold text-foreground">
                  Sign in
                </h1>
                <p className="mt-1 text-sm text-slate-500">Hotel Management System</p>
              </div>

              <div className="hidden md:block">
                <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
                  Welcome
                </h1>
              </div>

              {passwordJustReset && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                  Your password was updated. Sign in with your new password.
                </div>
              )}

              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Username
                  </label>
                  <input
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="e.g. hoteladmin"
                    className="h-11 rounded-xl border border-input bg-background px-3.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Your password"
                    className="h-11 rounded-xl border border-input bg-background px-3.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label htmlFor="remember-me" className="mb-0 inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
                    <input
                      id="remember-me"
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    Remember me
                  </label>
                  <Link
                    href="/login/forgot-password"
                    className="font-medium text-primary hover:text-primary-hover"
                  >
                    Forgot password?
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary-hover disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
                {error && <div className="error text-destructive text-sm">{error}</div>}
              </form>

              <div className="flex justify-center">
                <Link
                  href="/"
                  className="text-sm font-medium text-primary hover:text-primary-hover hover:underline"
                >
                  Back to landing page
                </Link>
              </div>

              <p className="text-center text-xs text-slate-500">
                Secured with JWT · Hotel-scoped access after login
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-[#e0f2fe] to-[#fef3c7]">
          <div className="text-sm text-slate-500">Loading…</div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
