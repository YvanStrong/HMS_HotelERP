import Link from "next/link";
import { HmsPublicHeader } from "./HmsPublicHeader";

export function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-shell theme-guest">
      <div className="hms-surface-card hms-surface-card--stretch">
        <HmsPublicHeader />
        <div className="guest-shell-main">{children}</div>
        <footer className="guest-shell-footer">
          <Link href="/">Home</Link>
          <span className="guest-shell-footer-dot">·</span>
          <span>Rates confirmed when you book.</span>
        </footer>
      </div>
    </div>
  );
}
