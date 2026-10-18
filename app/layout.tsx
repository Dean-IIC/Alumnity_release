import type { Metadata } from "next";
import { DM_Sans, Figtree, Young_Serif } from "next/font/google";
import { INTRO_PREFERENCE_SCRIPT } from "../lib/intro-preference";
import { THEME_SCRIPT } from "../lib/theme";
import "./globals.css";

// Self-hosted by Next at build time: no render-blocking request to Google on load.
// Figtree for the interface, Young Serif for the human voice (chosen in the /lab comparison).
// Figtree as its one variable font (every weight in one file) rather than four static ones:
// a phone decodes one font on first paint instead of four.
const sans = Figtree({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });
// The wordmark keeps its own face: the logo shouldn't change when the body font does.
const wordmark = DM_Sans({ subsets: ["latin"], weight: "700", variable: "--font-wordmark-face", display: "swap" });

const SITE = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3004");

export const metadata: Metadata = {
  // Shared links (an invitation on WhatsApp, mostly) show a card: this title, this line, and
  // public/og.jpg (1200×630, under 100 KB: WhatsApp leaves out bigger pictures). It was drawn
  // once with next/og (git history: app/opengraph-image.tsx) and saved as a JPEG.
  metadataBase: new URL(SITE),
  title: "Alumnity · HKBK College of Engineering alumni",
  description: "A place for HKBK College of Engineering students and alumni to ask, guide and grow together.",
  openGraph: {
    siteName: "Alumnity",
    title: "Alumnity · HKBK College of Engineering alumni",
    description: "A place for HKBK College of Engineering students and alumni to ask, guide and grow together.",
    locale: "en_IN",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Alumnity: HKBK College of Engineering's students and alumni" }]
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${wordmark.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INTRO_PREFERENCE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
