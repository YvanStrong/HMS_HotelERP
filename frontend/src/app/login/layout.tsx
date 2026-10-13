import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...privatePageMetadata,
  title: "Staff sign in",
  description: "Secure staff sign in for Kivu Cloud HotelERP.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
