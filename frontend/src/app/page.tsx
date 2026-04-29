import Image from "next/image";
import Link from "next/link";
import { HmsPublicHeader } from "@/components/HmsPublicHeader";
import { swaggerUiUrl } from "@/lib/api";
import { HomeLinks } from "./HomeLinks";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=85";

export default function HomePage() {
  const apiDocsUrl = swaggerUiUrl();

  return (
    <div className="theme-guest landing hms-surface-card">
      <HmsPublicHeader />
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
          <p className="landing-tagline">Stays made simple</p>
          <h1 className="landing-headline">Find a place you will love</h1>
          <p className="landing-sub">
            Search by property, dates, and guests — then pick a room and confirm. Create an account anytime to save your
            trips.
          </p>
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
        <section className="landing-band" aria-labelledby="how-heading">
          <h2 id="how-heading" className="landing-section-title">
            How it works
          </h2>
          <ul className="landing-steps">
            <li>
              <span className="landing-step-num">1</span>
              <div>
                <strong>Search</strong>
                <span className="landing-step-desc">Pick a hotel, your dates, and who is traveling.</span>
              </div>
            </li>
            <li>
              <span className="landing-step-num">2</span>
              <div>
                <strong>Book</strong>
                <span className="landing-step-desc">Check dates, confirm, and get your code.</span>
              </div>
            </li>
            <li>
              <span className="landing-step-num">3</span>
              <div>
                <strong>Stay</strong>
                <span className="landing-step-desc">Look up your trip anytime — sign in optional.</span>
              </div>
            </li>
          </ul>
        </section>

        <div className="landing-grid">
          <section className="panel landing-card">
            <h2 className="landing-card-title">Travelers</h2>
            <p className="landing-card-lead">Everything you need before you arrive.</p>
            <ul className="landing-guest-links">
              <li>
                <Link href="/book">Start booking</Link>
                <span>One search bar: hotel, check-in and check-out, guests — then checkout.</span>
              </li>
              <li>
                <Link href="/book/register">Create an account</Link>
                <span>One hotel at a time — see your trips in one place.</span>
              </li>
              <li>
                <Link href="/book/me">Your trips</Link>
                <span>For signed-in guests.</span>
              </li>
              <li>
                <Link href="/book/lookup">Already booked?</Link>
                <span>Look up with your email and confirmation code.</span>
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
            <p className="landing-card-lead">Front desk, housekeeping, and managers — your tools live here.</p>
            <div className="landing-actions" style={{ marginBottom: "1rem" }}>
              <Link className="landing-cta-secondary" href="/login">
                Open console
              </Link>
            </div>
            <div className="landing-staff-tools">
              <p className="landing-tools-label">Quick links</p>
              <HomeLinks />
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
                <Link href="/setup">Setup guide</Link>
              </li>
            </ul>
          </div>
          <div className="landing-footer-dev">
            <p className="landing-footer-col-title">Developers</p>
            <p>
              <a href={apiDocsUrl} target="_blank" rel="noopener noreferrer">
                API docs (Swagger)
              </a>
            </p>
            <p className="landing-footer-fineprint">Configure your API URL with NEXT_PUBLIC_API_URL.</p>
          </div>
        </div>
        <p className="landing-footer-bottom">© {new Date().getFullYear()} HMS · Internal roadmap in repo docs</p>
      </footer>
    </div>
  );
}
