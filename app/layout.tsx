import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { INTRO_PREFERENCE_SCRIPT } from "../lib/intro-preference";
import "./globals.css";

// Self-hosted by Next at build time: no render-blocking request to Google on load.
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Alumnity · HKBK College of Engineering alumni",
  description: "A place for HKBK College of Engineering students and alumni to ask, guide and grow together."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_PREFERENCE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
