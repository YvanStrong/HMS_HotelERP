import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Hotels to book",
  description:
    "Browse hotels on Kivu Cloud HotelERP. Compare rooms, rates, and availability, then book direct.",
  path: "/book/hotels",
});

export default function BookHotelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
