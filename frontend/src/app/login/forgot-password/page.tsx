"use client";

import Link from "next/link";
import { useState } from "react";
import { publicFetch } from "@/lib/publicApi";

type ForgotResponse = {
  message: string;
  debugResetUrl?: string | null;
};

export default function ForgotPasswordPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ForgotResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await publicFetch<ForgotResponse>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ usernameOrEmail: usernameOrEmail.trim() }),
      });
      setDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-svh flex flex-col bg-gradient-to-br from-[#e0f2fe] via-white to-[#fef3c7] p-3 sm:p-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="rounded-2xl border border-sky-200/70 bg-white p-6 shadow-[0_20px_50px_rgba(26,58,92,0.14)] sm:p-8">
          <div className="mb-6">
            <Link
              href="/login"
              className="text-sm font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-hover))]"
            >
              ← Back to sign in
            </Link>
            <h1 className="mt-4 font-serif text-2xl font-semibold text-[hsl(var(--foreground))]">Forgot password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the username or email on your account. If it matches, you can set a new password.
            </p>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{done.message}</div>
              {done.debugResetUrl ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <p className="font-medium text-amber-950">Development / testing link</p>
                  <p className="mt-1 text-amber-900">
                    Email is not configured — open this link once to choose a new password. Disable link exposure in production (
                    <code className="rounded bg-amber-100/80 px-1">hms.auth.password-reset.expose-reset-link-in-json</code>
                    ).
                  </p>
                  <Link
                    href={done.debugResetUrl}
                    className="mt-3 inline-block font-medium text-[hsl(var(--primary))] underline underline-offset-2"
                  >
                    Continue to reset password →
                  </Link>
                </div>
              ) : null}
              <Link href="/login" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
                Return to sign in
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label
                  htmlFor="forgot-identity"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]/80"
                >
                  Username or email
                </label>
                <input
                  id="forgot-identity"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="e.g. hoteladmin or you@hotel.com"
                  required
                  className="h-11 w-full rounded-xl border border-[hsl(var(--primary))]/25 bg-white px-3.5 text-[hsl(var(--foreground))] placeholder:text-muted-foreground/70 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/25"
                />
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <button
                type="submit"
                disabled={loading || !usernameOrEmail.trim()}
                className="h-11 w-full rounded-xl bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-md transition hover:bg-[hsl(var(--primary-hover))] disabled:opacity-60"
              >
                {loading ? "Sending…" : "Continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
