import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthCookieSync } from "@/components/AuthCookieSync";
import { ErrorPopupHost } from "@/components/ErrorPopupHost";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/lib/theme";
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

const themeInitScript = `(function(){try{var t=localStorage.getItem('hms-theme');var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
