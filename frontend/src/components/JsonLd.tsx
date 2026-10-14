import { BRAND_NAME, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

function Script({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization, product, and site schema for Google / Bing. */
export function SiteJsonLd() {
  const logo = absoluteUrl("/images/kivu-cloud-solutions-logo.png");
  return (
    <>
      <Script
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: BRAND_NAME,
          url: SITE_URL,
          logo,
          areaServed: { "@type": "Country", name: "Rwanda" },
          address: {
            "@type": "PostalAddress",
            addressCountry: "RW",
            addressLocality: "Kigali",
          },
        }}
      />
      <Script
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "Hotel property management system",
          operatingSystem: "Web",
          url: SITE_URL,
          image: logo,
          description:
            "Cloud hotel management software for Rwanda: reservations, front desk, housekeeping, POS, invoicing, and guest booking.",
          offers: {
            "@type": "Offer",
            priceCurrency: "RWF",
            url: absoluteUrl("/pricing"),
            availability: "https://schema.org/InStock",
          },
          provider: { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
        }}
      />
      <Script
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          publisher: { "@type": "Organization", name: BRAND_NAME },
          potentialAction: {
            "@type": "SearchAction",
            target: `${absoluteUrl("/book/hotels")}?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
    </>
  );
}

export function LodgingJsonLd({
  name,
  description,
  url,
  image,
  address,
}: {
  name: string;
  description?: string | null;
  url: string;
  image?: string | null;
  address?: string | null;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "LodgingBusiness",
        name,
        description: description || `Book rooms at ${name} with ${SITE_NAME}.`,
        url,
        image: image || undefined,
        address: address
          ? { "@type": "PostalAddress", streetAddress: address, addressCountry: "RW" }
          : { "@type": "PostalAddress", addressCountry: "RW" },
      }}
    />
  );
}
