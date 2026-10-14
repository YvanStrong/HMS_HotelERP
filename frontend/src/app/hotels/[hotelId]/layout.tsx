import type { Metadata } from "next";
import { HotelStaffShell } from "@/components/HotelStaffShell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...privatePageMetadata,
  title: "Dashboard",
};

export default function HotelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { hotelId: string };
}) {
  return <HotelStaffShell hotelId={params.hotelId}>{children}</HotelStaffShell>;
}
