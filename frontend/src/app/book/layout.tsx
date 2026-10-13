import type { Metadata } from "next";
import { GuestShell } from "@/components/GuestShell";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Book a hotel in Rwanda",
  description:
    "Search live hotel availability, compare rooms, and confirm your stay online with Kivu Cloud HotelERP guest booking.",
  path: "/book",
});

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <GuestShell>{children}</GuestShell>;
}
