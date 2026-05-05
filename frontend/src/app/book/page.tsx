import { BookSearchHero } from "@/components/BookSearchHero";
import Link from "next/link";

export default function BookHomePage() {
  return (
    <div className="space-y-6">
      <BookSearchHero />
      <section className="container-page pb-8">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
            <p className="text-sm font-semibold">Flexible discovery</p>
            <p className="text-sm text-muted-foreground mt-1">Browse all published hotels and compare before booking.</p>
            <Link href="/book/hotels" className="text-sm font-medium text-primary hover:underline mt-3 inline-block">
              Browse hotels
            </Link>
          </article>
          <article className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
            <p className="text-sm font-semibold">Already booked?</p>
            <p className="text-sm text-muted-foreground mt-1">Find your reservation with confirmation code and email.</p>
            <Link href="/book/lookup" className="text-sm font-medium text-primary hover:underline mt-3 inline-block">
              Look up reservation
            </Link>
          </article>
          <article className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
            <p className="text-sm font-semibold">Guest account</p>
            <p className="text-sm text-muted-foreground mt-1">Sign up to track current and past trips in one place.</p>
            <Link href="/book/register" className="text-sm font-medium text-primary hover:underline mt-3 inline-block">
              Create account
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
