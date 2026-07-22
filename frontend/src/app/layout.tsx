import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthCookieSync } from "@/components/AuthCookieSync";
import { ErrorPopupHost } from "@/components/ErrorPopupHost";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "HMS | Hotel Management System",
    template: "%s | HMS",
  },
  icons: {
    icon: [{ url: "/images/kivu-cloud-mark.png", type: "image/png" }],
  },
  description: "Modern Hotel Management System - Book rooms, manage reservations, and streamline your hotel operations.",
  keywords: ["hotel", "booking", "reservation", "management", "hospitality"],
  authors: [{ name: "HMS" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "HMS Hotel Management System",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e0f2fe" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} hms-body`}>
        <QueryProvider>
          <AuthCookieSync />
          <ErrorPopupHost />
          <div className="hms-canvas">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
