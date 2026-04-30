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
    <div className="min-h-screen flex items-start justify-center pt-20 px-4 bg-gradient-to-br from-[hsl(40,33%,96%)] via-[hsl(30,20%,94%)] to-[hsl(31,28%,92%)]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-card border border-border/50 overflow-hidden">
          <div className="px-6 py-8 sm:px-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in with your hotel or platform account
              </p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="hoteladmin"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="mt-1"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in…" : "Sign in"}
              </button>
              {error && <div className="error">{error}</div>}
            </form>

            <div className="mt-6 pt-6 border-t text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                New guest?{" "}
                <Link href="/book/register" className="font-medium">
                  Create an account
                </Link>
              </p>
              <p className="text-sm">
                <Link href="/" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to home
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
