import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { INTRO_PREFERENCE_SCRIPT } from "../lib/intro-preference";
import { THEME_SCRIPT } from "../lib/theme";
import { Backdrop } from "../components/backdrop";
import { CardMotion } from "../components/card-motion";
import "./globals.css";

// Self-hosted by Next at build time: no render-blocking request to Google on load.
// IBM Plex Sans, the college site's own face (hkbkce.in): this is its alumni network.
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
// Headings: the same face in bold only, so every heading set in the "voice" renders bold
// without each rule having to ask for it.
const serif = IBM_Plex_Sans({ subsets: ["latin"], weight: "700", variable: "--font-serif", display: "swap" });

const SITE = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3004");

export const metadata: Metadata = {
  // Shared links (an invitation on WhatsApp, mostly) show a card: this title, this line, and
  // public/og.jpg (1200×630, under 100 KB: WhatsApp leaves out bigger pictures). It was drawn
  // once with next/og (git history: app/opengraph-image.tsx) and saved as a JPEG.
  metadataBase: new URL(SITE),
  title: "Alumnity · HKBK College of Engineering alumni",
  description: "Students and alumni of HKBK College of Engineering help each other and stay in touch.",
  openGraph: {
    siteName: "Alumnity",
    title: "Alumnity · HKBK College of Engineering alumni",
    description: "Students and alumni of HKBK College of Engineering help each other and stay in touch.",
    locale: "en_IN",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Alumnity: HKBK College of Engineering's students and alumni" }]
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INTRO_PREFERENCE_SCRIPT }} />
      </head>
      <body>
        <Backdrop />
        <CardMotion />
        {children}
      </body>
    </html>
  );
}
