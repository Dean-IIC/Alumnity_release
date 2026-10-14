import type { Metadata } from "next";
import { DM_Sans, Figtree, Young_Serif } from "next/font/google";
import { INTRO_PREFERENCE_SCRIPT } from "../lib/intro-preference";
import "./globals.css";

// Self-hosted by Next at build time: no render-blocking request to Google on load.
// Figtree for the interface, Young Serif for the human voice (chosen in the /lab comparison).
const sans = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const serif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });
// The wordmark keeps its own face: the logo shouldn't change when the body font does.
const wordmark = DM_Sans({ subsets: ["latin"], weight: "700", variable: "--font-wordmark-face", display: "swap" });

export const metadata: Metadata = {
  title: "Alumnity · HKBK College of Engineering alumni",
  description: "A place for HKBK College of Engineering students and alumni to ask, guide and grow together."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${wordmark.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_PREFERENCE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
