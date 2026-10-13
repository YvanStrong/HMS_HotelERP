import type { Metadata } from "next";
import { LodgingJsonLd } from "@/components/JsonLd";
import {
  DEFAULT_DESCRIPTION,
  absoluteUrl,
  fetchPublicHotelForSeo,
  pageMetadata,
} from "@/lib/seo";

type Props = { children: React.ReactNode; params: { hotelId: string } };

export async function generateMetadata({ params }: { params: { hotelId: string } }): Promise<Metadata> {
  const hotel = await fetchPublicHotelForSeo(params.hotelId);
  const path = `/book/hotels/${params.hotelId}`;
  if (!hotel) {
    return pageMetadata({
      title: "Book this hotel",
      description: DEFAULT_DESCRIPTION,
      path,
    });
  }
  const description =
    (hotel.description && hotel.description.trim()) ||
    `Book rooms at ${hotel.name}${hotel.address ? ` — ${hotel.address}` : ""}. Live availability and instant confirmation on Kivu Cloud HotelERP.`;
  return pageMetadata({
    title: `Book ${hotel.name}`,
    description,
    path,
    image: hotel.imageUrl || hotel.logoUrl || undefined,
  });
}

export default async function BookHotelLayout({ children, params }: Props) {
  const hotel = await fetchPublicHotelForSeo(params.hotelId);
  const url = absoluteUrl(`/book/hotels/${params.hotelId}`);
  return (
    <>
      {hotel ? (
        <LodgingJsonLd
          name={hotel.name}
          description={hotel.description}
          url={url}
          image={hotel.imageUrl || hotel.logoUrl}
          address={hotel.address}
        />
      ) : null}
      {children}
    </>
  );
}
