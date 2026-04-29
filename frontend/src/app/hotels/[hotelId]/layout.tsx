import { HotelStaffShell } from "@/components/HotelStaffShell";

export default function HotelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { hotelId: string };
}) {
  return <HotelStaffShell hotelId={params.hotelId}>{children}</HotelStaffShell>;
}
