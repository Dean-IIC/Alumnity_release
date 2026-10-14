import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DM_Sans,
  DM_Serif_Display,
  Figtree,
  Fraunces,
  Instrument_Sans,
  Instrument_Serif,
  Manrope,
  Newsreader,
  Plus_Jakarta_Sans,
  Work_Sans,
  Young_Serif
} from "next/font/google";
import { TypeLab, type Pairing } from "../../components/lab/type-lab";
import "../styles/lab.css";

/*
 * A design lab, for development only: font pairings and hero copy, side by side, in the
 * real hero layout. Not linked from the site and not built into production.
 */

export const metadata: Metadata = { title: "Alumnity · type & copy lab", robots: { index: false } };

const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--lab-dm-serif" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--lab-dm-sans" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--lab-fraunces" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--lab-manrope" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--lab-instrument-serif" });
const instrumentSans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--lab-instrument-sans" });
const youngSerif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--lab-young-serif" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--lab-figtree" });
const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--lab-newsreader" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--lab-work-sans" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--lab-jakarta" });

const PAIRINGS: Pairing[] = [
  {
    id: "dm",
    name: "DM Serif Display + DM Sans",
    note: "What we have now. High-contrast, a little formal; the sans is clean and quiet.",
    voice: "var(--lab-dm-serif)",
    ui: "var(--lab-dm-sans)"
  },
  {
    id: "fraunces",
    name: "Fraunces + Manrope",
    note: "A soft, slightly wonky old-style serif: the most hand-made, closest to ink on paper.",
    voice: "var(--lab-fraunces)",
    ui: "var(--lab-manrope)"
  },
  {
    id: "instrument",
    name: "Instrument Serif + Instrument Sans",
    note: "Condensed and editorial, like a good magazine. Elegant, very current.",
    voice: "var(--lab-instrument-serif)",
    ui: "var(--lab-instrument-sans)"
  },
  {
    id: "young",
    name: "Young Serif + Figtree",
    note: "Sturdy and friendly, warm without being cute. Reads well at every size.",
    voice: "var(--lab-young-serif)",
    ui: "var(--lab-figtree)"
  },
  {
    id: "newsreader",
    name: "Newsreader + Work Sans",
    note: "Bookish and trustworthy, like a college publication. The calmest option.",
    voice: "var(--lab-newsreader)",
    ui: "var(--lab-work-sans)"
  },
  {
    id: "fraunces-jakarta",
    name: "Fraunces + Plus Jakarta Sans",
    note: "The hand-made serif with a rounder, friendlier interface face.",
    voice: "var(--lab-fraunces)",
    ui: "var(--lab-jakarta)"
  }
];

export default function LabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const fonts = [dmSerif, dmSans, fraunces, manrope, instrumentSerif, instrumentSans, youngSerif, figtree, newsreader, workSans, jakarta]
    .map((font) => font.variable)
    .join(" ");
  return (
    <div className={fonts}>
      <TypeLab pairings={PAIRINGS} />
    </div>
  );
}
