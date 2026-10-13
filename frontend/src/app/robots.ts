import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/book", "/book/hotels", "/book/lookup", "/book/register"],
        disallow: [
          "/hotels/",
          "/platform/",
          "/login",
          "/login/",
          "/setup",
          "/reset-password",
          "/subscription-blocked",
          "/api/",
          "/book/me",
          "/book/order/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
