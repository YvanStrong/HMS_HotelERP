import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing & demo",
  description:
    "HMS HotelERP subscription plans — Starter, Professional, and Enterprise. Book a product demo for your property.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
