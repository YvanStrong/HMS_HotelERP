import { Suspense } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Create a guest account",
  description: "Register to save trips, manage bookings, and check in faster with Kivu Cloud HotelERP.",
  path: "/book/register",
});

export default function BookRegisterLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
