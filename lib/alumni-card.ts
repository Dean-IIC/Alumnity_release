import { initialsOf } from "../components/profile/ink-seal";
import { batchYears, ROLE_LABEL } from "./format";

/*
 * A member's digital alumni card: what goes on it, worked out in one place so the card on
 * their page and the PNG they download say exactly the same thing.
 *
 * Only what a card should carry, picked field by field (never by copying the member's
 * record), so nothing private can ride along: no USN (the college's own ID, which stays
 * between a member and the college), no email. The member number is Alumnity's own,
 * made from the account's id, which already appears in the link to their page.
 */

export type CardPerson = {
  id: number;
  name: string;
  role: string;
  branch: string | null;
  branchName: string | null;
  programme: string | null;
  joined: number | null;
};

export type AlumniCard = {
  /** "ALM-000123": Alumnity's member number, from the account id. */
  memberNo: string;
  name: string;
  initials: string;
  /** "Alumnus", "Student", "Faculty"… */
  role: string;
  /** Their branch or department in full ("Computer Science and Engineering"), or its code. */
  department: string | null;
  /** "Batch 2012–16", or null for staff (who didn't join as students). */
  batch: string | null;
  /** The year they joined Alumnity. */
  since: number | null;
  /** Their profile photo, if they've added one: a photo key (its upload id, and how they framed it: lib/photo-crop.ts). */
  photoId: string | null;
  /** Their page, in full, for the QR code: anyone who scans it lands on (and logs in to see) it. */
  link: string;
  /** The same, short, to print under the QR code ("alumnity.in/people/123"). */
  shortLink: string;
};

/** "ALM-000123": six digits at least, so early members' numbers look like the rest. */
export const memberNumber = (id: number) => `ALM-${String(Math.trunc(Math.abs(id))).padStart(6, "0")}`;

export const MEMBER_NUMBER = /^ALM-\d{6,}$/;

/** "Super administrator" is a site setting, not a title for a card. */
const cardRole = (role: string) => (role === "superadmin" ? "Administrator" : (ROLE_LABEL[role] ?? "Member"));

/** The card for `person`. `origin` is the site's address ("https://alumnity.example"). */
export function alumniCard(person: CardPerson, extra: { since: number | null; photoId: string | null; origin: string }): AlumniCard {
  const path = `/people/${person.id}`;
  const origin = extra.origin.replace(/\/+$/, "");
  return {
    memberNo: memberNumber(person.id),
    name: person.name,
    initials: initialsOf(person.name),
    role: cardRole(person.role),
    department: person.branchName ?? person.branch,
    batch: person.joined ? `Batch ${batchYears(person.joined, person.programme)}` : null,
    since: extra.since,
    photoId: extra.photoId,
    link: `${origin}${path}`,
    shortLink: `${origin.replace(/^https?:\/\/(www\.)?/, "")}${path}`
  };
}

// ---------- The pattern ----------

/*
 * The fine gold linework behind the card, as on a certificate or a banknote (a guilloche):
 * a ribbon of interlaced waves along the card and a rosette to the right. Drawn from a few
 * sums of sines, so it's a few kilobytes of path rather than an image, and identical on
 * the page and in the PNG. In the card's own units: 856 × 540 (its millimetres, × 10).
 */

export const CARD_W = 856;
export const CARD_H = 540;

const fmt = (n: number) => String(Math.round(n * 10) / 10);

function polyline(points: [number, number][]) {
  return "M" + points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(" ");
}

let pattern: { waves: string; rosette: string } | null = null;

export function guilloche(): { waves: string; rosette: string } {
  if (pattern) return pattern;
  const waves: string[] = [];
  const LINES = 14;
  for (let k = 0; k < LINES; k++) {
    const phase = (k / LINES) * Math.PI * 2;
    const points: [number, number][] = [];
    for (let x = -10; x <= CARD_W + 10; x += 8) {
      const t = (x / CARD_W) * Math.PI * 2;
      points.push([x, 392 + 58 * Math.sin(1.5 * t + phase) + 26 * Math.sin(3.5 * t - phase)]);
    }
    waves.push(polyline(points));
  }
  // A rosette: a circle with a faster circle riding on it, closed after one turn.
  const rosette: string[] = [];
  for (const [outer, inner, petals] of [
    [118, 34, 18],
    [92, 28, 18],
    [64, 20, 12]
  ]) {
    const points: [number, number][] = [];
    for (let i = 0; i <= 540; i++) {
      const t = (i / 540) * Math.PI * 2;
      const r = outer + inner * Math.cos(petals * t);
      points.push([706 + r * Math.cos(t), 196 + r * Math.sin(t)]);
    }
    rosette.push(polyline(points) + "z");
  }
  pattern = { waves: waves.join(""), rosette: rosette.join("") };
  return pattern;
}

/** The pattern as a standalone SVG (for the PNG, where it's drawn as an image). */
export function guillocheSvg(stroke = "#ffb400"): string {
  const { waves, rosette } = guilloche();
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">` +
    `<g fill="none" stroke="${stroke}" stroke-width="0.9"><path d="${waves}" opacity="0.28"/><path d="${rosette}" opacity="0.26"/></g></svg>`
  );
}

/**
 * The card's designs, chosen by its owner (kept in their browser): the same two colours drive
 * the card on the page (CSS) and the PNG they download (lib/server/alumni-card-image.tsx).
 * Every one is dark enough for the card's white words and gold to read on it.
 */
export const CARD_THEMES = [
  { key: "navy", label: "Navy blue", dark: "#0a2a57", light: "#123e7c" },
  { key: "crimson", label: "Red", dark: "#5c0f12", light: "#b91c1c" },
  { key: "emerald", label: "Green", dark: "#053d2c", light: "#15803d" },
  { key: "royal", label: "Purple", dark: "#2e0b5c", light: "#6d28d9" },
  { key: "midnight", label: "Black", dark: "#05070d", light: "#1f2937" },
  { key: "sunset", label: "Orange", dark: "#7c2d12", light: "#d97706" }
] as const;

export type CardThemeKey = (typeof CARD_THEMES)[number]["key"];

/** A design by its key; anything unknown is the college's navy. */
export const cardTheme = (key: string | null | undefined) => CARD_THEMES.find((t) => t.key === key) ?? CARD_THEMES[0];
