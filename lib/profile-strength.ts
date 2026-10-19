import type { Role } from "./server/auth";
import type { Profile } from "./server/profile";

/*
 * How full a member's page is, as LinkedIn's "profile strength": a percentage, a word
 * for it, and what's left, each with a link to the very field that fills it. Only the
 * parts that fit who they are count: a student is asked what they're looking for, an
 * alumnus or a teacher what they're happy to help with; staff aren't asked where they
 * work (it's HKBK). Each role's weights add up to 100, so a full page is exactly 100%.
 *
 * Worked out from the page itself (lib/server/profile.ts): no extra query.
 */

export type StrengthItem = { key: string; label: string; href: string; weight: number };
export type Strength = { percent: number; done: StrengthItem[]; missing: StrengthItem[] };

type Kind = "student" | "alumnus" | "staff";
type Check = { key: string; label: string; href: string; weight: number; done: (p: Profile) => boolean };

/** Three skills: enough for juniors searching by them to find you. */
export const SKILLS_WANTED = 3;

const EDIT = "/me/edit";
const filled = (s: string) => s.trim().length > 0;

const kindOf = (role: Role): Kind => (role === "student" ? "student" : role === "alumnus" ? "alumnus" : "staff");

const photo: Check = { key: "photo", label: "Add a photo", href: `${EDIT}#edit-photo`, weight: 15, done: (p) => Boolean(p.photo) };
const city: Check = { key: "city", label: "Add your city", href: `${EDIT}#edit-city`, weight: 5, done: (p) => filled(p.city) };
const about: Check = { key: "about", label: "Write a few lines about you", href: `${EDIT}#edit-about`, weight: 15, done: (p) => filled(p.about) };
const skills: Check = {
  key: "skills",
  label: "Add three things you're good at",
  href: `${EDIT}#edit-skills`,
  weight: 15,
  done: (p) => p.skills.filter(filled).length >= SKILLS_WANTED
};
const links: Check = {
  key: "links",
  label: "Add your LinkedIn or a website",
  href: `${EDIT}#edit-links`,
  weight: 5,
  done: (p) => filled(p.links.linkedin) || filled(p.links.website)
};
const happyTo: Check = {
  key: "happyTo",
  label: "Say what you're happy to help with",
  href: `${EDIT}#edit-happy-to`,
  weight: 10,
  done: (p) => Object.values(p.happyTo).some(Boolean)
};
const hasAny = (p: Profile, kinds: (keyof Profile["sections"])[]) => kinds.some((k) => (p.sections[k]?.length ?? 0) > 0);

const CHECKS: Record<Kind, Check[]> = {
  alumnus: [
    photo,
    { key: "title", label: "Say what you do now", href: `${EDIT}#edit-title`, weight: 15, done: (p) => filled(p.title) },
    { key: "company", label: "Add where you work", href: `${EDIT}#edit-company`, weight: 10, done: (p) => filled(p.company) },
    city,
    about,
    skills,
    happyTo,
    { key: "background", label: "Add your experience or education", href: `${EDIT}#edit-sections`, weight: 10, done: (p) => hasAny(p, ["experience", "education"]) },
    links
  ],
  student: [
    photo,
    { key: "title", label: "Say what you're up to", href: `${EDIT}#edit-title`, weight: 15, done: (p) => filled(p.title) },
    { key: "company", label: "Add where you study or intern", href: `${EDIT}#edit-company`, weight: 10, done: (p) => filled(p.company) },
    city,
    about,
    skills,
    {
      key: "seeking",
      label: "Say what you're looking for",
      href: `${EDIT}#edit-happy-to`,
      weight: 10,
      done: (p) => Object.values(p.seeking).some(Boolean)
    },
    {
      key: "background",
      label: "Add a project, internship or course",
      href: `${EDIT}#edit-sections`,
      weight: 10,
      done: (p) => hasAny(p, ["projects", "experience", "education", "certifications"])
    },
    links
  ],
  // Teachers and the college desk: no "where" (it's HKBK), so what they do there counts for more.
  staff: [
    photo,
    { key: "title", label: "Say what you teach or do at HKBK", href: `${EDIT}#edit-title`, weight: 20, done: (p) => filled(p.title) },
    city,
    about,
    skills,
    happyTo,
    { key: "background", label: "Add your experience or education", href: `${EDIT}#edit-sections`, weight: 15, done: (p) => hasAny(p, ["experience", "education"]) },
    links
  ]
};

/** What counts towards a full page for this role, with its weights (they add up to 100). */
export function strengthItems(role: Role): StrengthItem[] {
  return CHECKS[kindOf(role)].map(({ key, label, href, weight }) => ({ key, label, href, weight }));
}

/** How full `profile` is for a member with this role: what's done, and what's left, the biggest gains first. */
export function profileStrength(member: { role: Role }, profile: Profile): Strength {
  const done: StrengthItem[] = [];
  const missing: StrengthItem[] = [];
  for (const { done: isDone, ...item } of CHECKS[kindOf(member.role)]) (isDone(profile) ? done : missing).push(item);
  // Sort is stable: equal gains stay in the editor's order.
  missing.sort((a, b) => b.weight - a.weight);
  const percent = Math.min(100, done.reduce((sum, i) => sum + i.weight, 0));
  return { percent, done, missing };
}

/** A word for how far along it is. */
export function strengthLevel(percent: number): string {
  if (percent >= 100) return "Complete";
  if (percent >= 70) return "Strong";
  if (percent >= 40) return "Good";
  return "Getting started";
}
