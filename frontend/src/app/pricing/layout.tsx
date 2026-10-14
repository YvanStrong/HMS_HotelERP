import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing & demo",
  description:
    "HotelERP plans in Rwandan francs: Starter, Professional, and Enterprise. Reservations, POS, housekeeping, and guest booking. Request a product demo for your property.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
