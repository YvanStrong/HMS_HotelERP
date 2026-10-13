import type { MetadataRoute } from "next";
import { SITE_URL, fetchPublicHotelsForSeo } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/book`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/book/hotels`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/book/lookup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/book/register`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const hotels = await fetchPublicHotelsForSeo();
  const hotelPages: MetadataRoute.Sitemap = hotels.map((hotel) => ({
    url: `${SITE_URL}/book/hotels/${hotel.id}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticPages, ...hotelPages];
}
