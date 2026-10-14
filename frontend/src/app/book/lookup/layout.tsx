import { Suspense } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Find your booking",
  description: "Look up a hotel reservation with your confirmation code and email on Kivu Cloud HotelERP.",
  path: "/book/lookup",
});

export default function BookLookupLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
