import type { Metadata } from "next";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kivucloud.rw").replace(
  /\/$/,
  "",
);
export const SITE_NAME = "Kivu Cloud HotelERP";
export const BRAND_NAME = "Kivu Cloud Solutions";
export const DEFAULT_TITLE = "Kivu Cloud HotelERP | Hotel management software in Rwanda";
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
export const DEFAULT_DESCRIPTION =
  "HotelERP from Kivu Cloud Solutions: reservations, front desk, housekeeping, POS, invoicing, and guest booking for hotels in Rwanda. RWF pricing. Book a stay or request a demo.";
export const OG_IMAGE_PATH = "/images/kivu-cloud-solutions-logo.png";
export const MARK_ICON_PATH = "/images/kivu-cloud-mark.png";

export const SEO_KEYWORDS = [
  "hotel management system Rwanda",
  "HotelERP",
  "Kivu Cloud",
  "Kivu Cloud Solutions",
  "hotel software Kigali",
  "hotel booking Rwanda",
  "PMS Rwanda",
  "hotel POS",
  "hotel reservations software",
  "RRA EBM hotel",
  "hospitality software Rwanda",
  "guest booking portal",
];

export type PublicHotelSeo = {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
};

function apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && String(raw).trim()) return String(raw).trim().replace(/\/$/, "");
  return "http://127.0.0.1:8080";
}

export async function fetchPublicHotelsForSeo(): Promise<PublicHotelSeo[]> {
  try {
    const res = await fetch(`${apiOrigin()}/api/v1/public/hotels`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as PublicHotelSeo[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchPublicHotelForSeo(hotelId: string): Promise<PublicHotelSeo | null> {
  try {
    const res = await fetch(`${apiOrigin()}/api/v1/public/hotels/${hotelId}`, {
      next: { revalidate: 1800 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicHotelSeo;
  } catch {
    return null;
  }
}

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
    noarchive: true,
  },
};

export const privatePageMetadata: Metadata = {
  robots: PRIVATE_ROBOTS,
  referrer: "no-referrer",
};

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
  index?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  const image = absoluteUrl(opts.image || OG_IMAGE_PATH);
  const index = opts.index !== false;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true }
      : PRIVATE_ROBOTS,
    openGraph: {
      title: `${opts.title} | ${SITE_NAME}`,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      locale: "en_RW",
      type: "website",
      images: [{ url: image, alt: BRAND_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${opts.title} | ${SITE_NAME}`,
      description: opts.description,
      images: [image],
    },
  };
}
