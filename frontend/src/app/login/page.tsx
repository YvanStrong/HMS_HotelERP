"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { postLoginRedirectPath, saveAuthSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
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
    <div className="min-h-svh max-h-svh flex flex-col overflow-hidden bg-gradient-to-br from-[hsl(40_30%_97%)] via-[hsl(35_24%_94%)] to-[hsl(30_22%_88%)] p-3 sm:p-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl border border-[hsl(var(--primary))]/20 bg-white shadow-[0_20px_50px_rgba(58,45,40,0.12)] md:flex-row">
        <aside className="relative hidden shrink-0 flex-col justify-center overflow-hidden bg-[hsl(var(--primary))] px-8 py-8 text-[hsl(var(--primary-foreground))] md:flex md:w-[40%] lg:px-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 80% 80%, white 0, transparent 40%)",
            }}
          />
          <div className="relative z-[1] flex flex-col gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <span className="text-2xl font-bold tracking-tight">H</span>
            </div>
            <div>
              <p className="font-serif text-3xl font-semibold leading-snug lg:text-4xl">
                Grand Ubumwe
              </p>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-white/80">
                Hotel management
              </p>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/85">
              Staff sign-in for reservations, rooms, housekeeping, and billing — in warm chocolate and
              white, built to fit your screen.
            </p>
            <ul className="space-y-2 text-sm text-white/80">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-white/90" />
                Role-based access
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-white/90" />
                Secure JWT session
              </li>
            </ul>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
              <div className="md:hidden">
                <div className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--primary))]">
                  HMS · Staff
                </div>
                <h1 className="mt-3 font-serif text-2xl font-semibold text-[hsl(var(--foreground))]">
                  Sign in
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Grand Ubumwe management system</p>
              </div>

              <div className="hidden md:block">
                <h1 className="font-serif text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
                  Welcome back
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your staff username and password to continue.
                </p>
              </div>

              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]/80"
                  >
                    Username
                  </label>
                  <input
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="e.g. hoteladmin"
                    className="h-11 rounded-xl border border-[hsl(var(--primary))]/25 bg-[hsl(40_28%_99%)] px-3.5 text-[hsl(var(--foreground))] placeholder:text-muted-foreground/70 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/25"
                  />
                </div>
                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]/80"
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
                    className="h-11 rounded-xl border border-[hsl(var(--primary))]/25 bg-[hsl(40_28%_99%)] px-3.5 text-[hsl(var(--foreground))] placeholder:text-muted-foreground/70 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/25"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label htmlFor="remember-me" className="mb-0 inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
                    <input
                      id="remember-me"
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-[hsl(var(--primary))]/35 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30"
                    />
                    Remember me
                  </label>
                  <Link
                    href="#"
                    className="font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-hover))]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-xl bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-md transition hover:bg-[hsl(var(--primary-hover))] disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
                {error && <div className="error text-destructive text-sm">{error}</div>}
              </form>

              <p className="text-center text-xs text-muted-foreground">
                Secured with JWT · Hotel-scoped access after login
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
