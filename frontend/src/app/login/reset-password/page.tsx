"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { publicFetch } from "@/lib/publicApi";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tokenFromUrl.trim()) {
      setError("This page needs a valid link from your email or forgot-password flow.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await publicFetch<{ message: string }>("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: tokenFromUrl.trim(), newPassword: password }),
      });
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (!tokenFromUrl) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Missing reset token. Open the link from your email, or go through{" "}
          <Link href="/login/forgot-password" className="font-medium text-[hsl(var(--primary))] underline">
            forgot password
          </Link>{" "}
          again.
        </div>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[hsl(var(--primary))]/30 text-sm font-semibold text-[hsl(var(--primary))]"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label
          htmlFor="reset-pw"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]/80"
        >
          New password
        </label>
        <input
          id="reset-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          className="h-11 w-full rounded-xl border border-[hsl(var(--primary))]/25 bg-white px-3.5 text-[hsl(var(--foreground))] placeholder:text-muted-foreground/70 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/25"
        />
      </div>
      <div>
        <label
          htmlFor="reset-pw2"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]/80"
        >
          Confirm password
        </label>
        <input
          id="reset-pw2"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 w-full rounded-xl border border-[hsl(var(--primary))]/25 bg-white px-3.5 text-[hsl(var(--foreground))] placeholder:text-muted-foreground/70 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/25"
        />
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-xl bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-md transition hover:bg-[hsl(var(--primary-hover))] disabled:opacity-60"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
            <h1 className="mt-4 font-serif text-2xl font-semibold text-[hsl(var(--foreground))]">Set new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a strong password you have not used elsewhere.</p>
          </div>
          <Suspense
            fallback={<div className="animate-pulse rounded-xl bg-muted py-12 text-center text-sm text-muted-foreground">Loading…</div>}
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
