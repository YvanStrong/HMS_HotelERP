import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthCookieSync } from "@/components/AuthCookieSync";
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
  description: "Modern Hotel Management System - Book rooms, manage reservations, and streamline your hotel operations.",
  keywords: ["hotel", "booking", "reservation", "management", "hospitality"],
  authors: [{ name: "HMS" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "HMS Hotel Management System",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} hms-body`}>
        <AuthCookieSync />
        <div className="hms-canvas">{children}</div>
      </body>
    </html>
  );
}
