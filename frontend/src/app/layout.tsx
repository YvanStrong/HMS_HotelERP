import type { Metadata, Viewport } from "next";
import { AuthCookieSync } from "@/components/AuthCookieSync";
import { ErrorPopupHost } from "@/components/ErrorPopupHost";
import { SiteJsonLd } from "@/components/JsonLd";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/lib/theme";
import {
  BRAND_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  MARK_ICON_PATH,
  OG_IMAGE_PATH,
  SEO_KEYWORDS,
  SITE_NAME,
  SITE_URL,
  TITLE_TEMPLATE,
  absoluteUrl,
} from "@/lib/seo";
import "./globals.css";

const inter = {
  className: "",
  variable: "--font-inter",
};

const ogImage = absoluteUrl(OG_IMAGE_PATH);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  authors: [{ name: BRAND_NAME, url: SITE_URL }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  applicationName: SITE_NAME,
  category: "travel",
  referrer: "origin-when-cross-origin",
  icons: {
    icon: [{ url: MARK_ICON_PATH, type: "image/png" }],
    shortcut: MARK_ICON_PATH,
    apple: MARK_ICON_PATH,
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_RW",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: ogImage, alt: `${BRAND_NAME} HotelERP` }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0ea5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('hms-theme');var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-RW" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SiteJsonLd />
      </head>
      <body className={`${inter.className} hms-body`}>
        <ThemeProvider>
          <QueryProvider>
            <AuthCookieSync />
            <ErrorPopupHost />
            <div className="hms-canvas">{children}</div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
