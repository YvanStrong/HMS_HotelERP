"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HmsPublicHeader } from "@/components/HmsPublicHeader";
import { isGuestPortalUser, loadAuthUser, type AuthUser } from "@/lib/auth";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=85";

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(loadAuthUser());
  }, []);

  const showStaffBanner = Boolean(user && !isGuestPortalUser(user));

  return (
    <div className="theme-guest landing hms-surface-card">
      <HmsPublicHeader />
      {showStaffBanner && (
        <div className="mx-auto mt-3 w-full max-w-6xl px-4">
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
            Signed in as staff.{" "}
            <Link href="/app" className="font-semibold text-primary hover:underline">
              Go to dashboard
            </Link>
          </div>
        </div>
      )}
      <section className="landing-hero-media" aria-label="Welcome">
        <div className="landing-hero-image-wrap">
          <Image
            src={HERO_IMAGE}
            alt="Resort pool and ocean view at sunset"
            fill
            priority
            sizes="100vw"
            className="landing-hero-img"
          />
          <div className="landing-hero-overlay" aria-hidden />
        </div>
        <div className="landing-hero-content">
          <p className="landing-tagline">HMS Booking</p>
          <h1 className="landing-headline">Find a place you will love</h1>
          <p className="landing-sub">Search, choose, and confirm your stay in a few quick steps.</p>
          <div className="landing-kpis" aria-label="Platform highlights">
            <span>Live availability</span>
            <span>Instant confirmation</span>
            <span>Self-service trips</span>
          </div>
          <div className="landing-hero-ctas">
            <Link className="landing-cta-primary" href="/book">
              Book a stay
            </Link>
            <Link className="landing-cta-outline" href="/login">
              Hotel team sign in
            </Link>
          </div>
        </div>
      </section>

      <main className="landing-main">
        <section className="landing-feature-strip" aria-label="Platform snapshot">
          <article className="landing-feature-tile">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-lg" aria-hidden>🔍</span>
              <h3>3-step flow</h3>
            </div>
            <p>Search, book, and manage trips.</p>
          </article>
          <article className="landing-feature-tile">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-lg" aria-hidden>🗝️</span>
              <h3>1 guest account</h3>
            </div>
            <p>Track your reservations in one place.</p>
          </article>
          <article className="landing-feature-tile">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-lg" aria-hidden>⏰</span>
              <h3>24/7 access</h3>
            </div>
            <p>Lookup and trip tools whenever needed.</p>
          </article>
        </section>

        <div className="landing-grid">
          <section className="panel landing-card">
            <h2 className="landing-card-title">Travelers</h2>
            <p className="landing-card-lead">Book, register, and track your stay.</p>
            <ul className="landing-guest-links">
              <li>
                <Link href="/book">Start booking</Link>
                <span>Choose hotel, dates, and guests.</span>
              </li>
              <li>
                <Link href="/book/register">Create an account</Link>
                <span>Save your trips and booking details.</span>
              </li>
              <li>
                <Link href="/book/me">Your trips</Link>
                <span>See reservations and status.</span>
              </li>
              <li>
                <Link href="/book/lookup">Already booked?</Link>
                <span>Find booking by confirmation code.</span>
              </li>
            </ul>
            <div className="landing-actions">
              <Link className="landing-cta-primary landing-cta-inline" href="/book">
                Book now
              </Link>
              <Link className="landing-cta-soft" href="/book/register">
                Create account
              </Link>
            </div>
          </section>

          <section className="panel landing-card">
            <h2 className="landing-card-title">Hotel team</h2>
            <p className="landing-card-lead">Operations workspace for hotel staff.</p>
            <ul className="landing-guest-links">
              <li>
                <span className="font-semibold text-foreground">Front desk</span>
                <span>Reservations and arrivals.</span>
              </li>
              <li>
                <span className="font-semibold text-foreground">Housekeeping</span>
                <span>Room status and cleaning flow.</span>
              </li>
              <li>
                <span className="font-semibold text-foreground">Operations & billing</span>
                <span>Invoices, payments, and activity.</span>
              </li>
            </ul>
            <div className="landing-actions">
              <Link className="landing-cta-secondary" href="/login">
                Open console
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="landing-site-footer">
        <div className="landing-site-footer-inner">
          <div className="landing-footer-brand">
            <strong>HMS Stays</strong>
            <span>Direct booking for guests. A calm workspace for your crew.</span>
          </div>
          <div>
            <p className="landing-footer-col-title">Explore</p>
            <ul className="landing-footer-links">
              <li>
                <Link href="/book">Book</Link>
              </li>
              <li>
                <Link href="/book/me">Your trips</Link>
              </li>
              <li>
                <Link href="/book/register">Register</Link>
              </li>
              <li>
                <Link href="/book/lookup">Find a booking</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="landing-footer-col-title">Hotel</p>
            <ul className="landing-footer-links">
              <li>
                <Link href="/login">Team sign in</Link>
              </li>
              <li>
                <Link href="/book/lookup">Guest booking lookup</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="landing-footer-bottom">© {new Date().getFullYear()} HMS</p>
      </footer>
    </div>
  );
}
