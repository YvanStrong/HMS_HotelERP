"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Outfit, Source_Serif_4 } from "next/font/google";
import { HmsPublicHeader } from "@/components/HmsPublicHeader";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pricing-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pricing-serif",
});

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2200&q=85";

type BillingCycle = "monthly" | "annual";

type Plan = {
  id: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  name: string;
  monthly: number;
  blurb: string;
  featured?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "STARTER",
    name: "Starter",
    monthly: 150000,
    blurb: "Front desk essentials for smaller properties.",
    features: [
      "Reservations & guest profiles",
      "Room & housekeeping board",
      "Basic invoices & folio",
      "Core analytics & reports",
      "Up to 50 rooms · 10 staff users",
      "Email support",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    monthly: 250000,
    blurb: "Full operations for growing hotels and resorts.",
    featured: true,
    features: [
      "Everything in Starter",
      "POS, F&B & self-order",
      "Inventory & channel tools",
      "Groups, events & packages",
      "Up to 150 rooms · 50 staff users",
      "Priority weekday support",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    monthly: 500000,
    blurb: "Scale, customization, and deeper operations.",
    features: [
      "Everything in Professional",
      "Higher room & user limits",
      "Advanced reports & HR modules",
      "Integrations & workflow options",
      "Dedicated onboarding",
      "Priority support 7 days a week",
    ],
  },
];

function formatAmount(amount: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount);
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const [selectedPlan, setSelectedPlan] = useState<string>("PROFESSIONAL");
  const [name, setName] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const priceLabel = useMemo(() => (cycle === "annual" ? "Annually" : "Monthly"), [cycle]);

  function planPrice(plan: Plan) {
    return cycle === "annual" ? plan.monthly * 12 : plan.monthly;
  }

  function selectPlan(planId: string) {
    setSelectedPlan(planId);
    const el = document.getElementById("demo");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onDemoSubmit(e: FormEvent) {
    e.preventDefault();
    const plan = PLANS.find((p) => p.id === selectedPlan)?.name ?? selectedPlan;
    const subject = encodeURIComponent(`HMS demo request — ${hotelName || "Hotel"} (${plan})`);
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Hotel: ${hotelName}`,
        `Email: ${email}`,
        `Phone: ${phone || "—"}`,
        `Plan interest: ${plan} (${cycle})`,
        "",
        message || "I would like a product demo.",
      ].join("\n"),
    );
    window.location.href = `mailto:billing@hms.local?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  return (
    <div className={`theme-guest pricing-page ${outfit.variable} ${sourceSerif.variable}`}>
      <HmsPublicHeader />

      <section className="pricing-hero" aria-label="HMS pricing">
        <div className="pricing-hero-media">
          <Image
            src={HERO_IMAGE}
            alt="Hotel lobby and reception desk"
            fill
            priority
            sizes="100vw"
            className="pricing-hero-img"
          />
          <div className="pricing-hero-overlay" aria-hidden />
          <div className="pricing-hero-wash" aria-hidden />
        </div>
        <div className="pricing-hero-copy">
          <p className="pricing-eyebrow">HMS pricing</p>
          <h1 className="pricing-brand">HotelERP</h1>
          <p className="pricing-lead">Fair pricing for hotels that want to grow without waiting on expiry to change plans.</p>
          <div className="pricing-hero-actions">
            <a className="pricing-cta-primary" href="#plans">
              View plans
            </a>
            <a className="pricing-cta-ghost" href="#demo">
              Book a demo
            </a>
          </div>
        </div>
      </section>

      <main>
        <section id="plans" className="pricing-plans-section">
          <div className="pricing-section-head">
            <h2>Flexible pricing for every property</h2>
            <p>Choose a convenient plan for your rooms, staff, and modules — renew or upgrade anytime mid-cycle.</p>
            <div className="pricing-cycle" role="group" aria-label="Billing cycle">
              <button
                type="button"
                className={cycle === "monthly" ? "is-active" : undefined}
                onClick={() => setCycle("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={cycle === "annual" ? "is-active" : undefined}
                onClick={() => setCycle("annual")}
              >
                Annually
              </button>
            </div>
          </div>

          <div className="pricing-grid">
            {PLANS.map((plan) => (
              <article key={plan.id} className={`pricing-card ${plan.featured ? "is-featured" : ""}`}>
                <header>
                  <p className="pricing-card-name">{plan.name}</p>
                  <p className="pricing-card-amount">
                    <span className="pricing-card-figure">{formatAmount(planPrice(plan))}</span>
                    <span className="pricing-card-currency">RWF</span>
                  </p>
                  <p className="pricing-card-cycle">{priceLabel}</p>
                  <p className="pricing-card-blurb">{plan.blurb}</p>
                </header>
                <button type="button" className="pricing-select" onClick={() => selectPlan(plan.id)}>
                  Select plan
                  <span aria-hidden>↗</span>
                </button>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className="pricing-check" aria-hidden>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="demo" className="pricing-demo-section">
          <div className="pricing-demo-grid">
            <div>
              <p className="pricing-eyebrow dark">Live walkthrough</p>
              <h2>See HMS on your property workflow</h2>
              <p>
                Book a short demo with our team. We cover front desk, billing, POS, and subscription options — including
                mid-cycle renewals and prorated upgrades.
              </p>
              <ul className="pricing-demo-points">
                <li>Tailored to your room count and modules</li>
                <li>No commitment — ask anything about rollout</li>
                <li>Same plans used in the live subscription console</li>
              </ul>
            </div>

            <form className="pricing-demo-form" onSubmit={onDemoSubmit}>
              <h3>Request a demo</h3>
              <label>
                Your name
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Uwase" />
              </label>
              <label>
                Hotel / property
                <input
                  required
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="Grand Hotel"
                />
              </label>
              <label>
                Work email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hotel.com"
                />
              </label>
              <label>
                Phone (optional)
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250 …" />
              </label>
              <label>
                Plan interest
                <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notes
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Preferred time, property size, modules you care about…"
                />
              </label>
              <button type="submit" className="pricing-cta-primary pricing-cta-block">
                Send demo request
              </button>
              {submitted && (
                <p className="pricing-demo-thanks">
                  Your email client should open with the request. If it does not, write us from your mail app with the
                  same details.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="landing-site-footer">
        <div className="landing-site-footer-inner">
          <div className="landing-footer-brand">
            <strong>HMS HotelERP</strong>
            <span>Operations, billing, and guest journeys in one system.</span>
          </div>
          <div>
            <p className="landing-footer-col-title">Explore</p>
            <ul className="landing-footer-links">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/book">Guest booking</Link>
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
                <Link href="/pricing#demo">Book a demo</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="landing-footer-bottom">© {new Date().getFullYear()} HMS</p>
      </footer>
    </div>
  );
}
