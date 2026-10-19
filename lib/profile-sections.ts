/*
 * The extra sections a member can add to their page, as on LinkedIn: each optional, each
 * a list of entries, each with its own "who can see this". One shape for every kind (a
 * title, where, the years, a link, a few words); each kind names those fields its own way.
 * Shared by the server (lib/server/profile.ts keeps only what's allowed) and the editor.
 */

export const SECTION_KINDS = ["experience", "education", "projects", "certifications", "organisations", "honours", "languages"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export type SectionEntry = {
  /** The role, the course, the project, the certificate, the award, the language. */
  title: string;
  /** Where: the company, the school, the club; who issued it; how well (for a language). */
  org: string;
  from: number | null;
  to: number | null;
  /** Still doing it (no end year). */
  current: boolean;
  link: string;
  detail: string;
};

type KindInfo = {
  /** The section's name on a page and in the "Add a section" menu. */
  label: string;
  /** What the menu says it's for. */
  hint: string;
  title: { label: string; placeholder: string };
  org: { label: string; placeholder: string } | null;
  /** "range": from and to (or "still here"); "year": one year; null: no years. */
  years: "range" | "year" | null;
  link: boolean;
  detail: boolean;
  /** For a language: how well, chosen from a list rather than typed. */
  levels?: readonly string[];
};

export const SECTIONS: Record<SectionKind, KindInfo> = {
  experience: {
    label: "Experience",
    hint: "Jobs and internships",
    title: { label: "Role", placeholder: "Software engineer, intern" },
    org: { label: "Company or group", placeholder: "Infosys" },
    years: "range",
    link: false,
    detail: true
  },
  education: {
    label: "Education",
    hint: "Other courses: school, PU, a master's degree",
    title: { label: "Course or degree", placeholder: "M.Tech, Computer Science" },
    org: { label: "School or college", placeholder: "IISc Bengaluru" },
    years: "range",
    link: false,
    detail: false
  },
  projects: {
    label: "Projects",
    hint: "Things you've built or made",
    title: { label: "Project", placeholder: "Smart traffic signal" },
    org: { label: "Who it was with or for (you can skip this)", placeholder: "Final-year project, a hackathon" },
    years: "year",
    link: true,
    detail: true
  },
  certifications: {
    label: "Certificates",
    hint: "Courses and certificates you've earned",
    title: { label: "Certificate", placeholder: "AWS Cloud Practitioner" },
    org: { label: "Given by", placeholder: "Amazon Web Services" },
    years: "year",
    link: true,
    detail: false
  },
  organisations: {
    label: "Clubs and groups",
    hint: "Student chapters, clubs, societies",
    title: { label: "Your role", placeholder: "Chair, Treasurer, Member" },
    org: { label: "Club or group", placeholder: "IEEE HKBKCE Student Chapter" },
    years: "range",
    link: false,
    detail: false
  },
  honours: {
    label: "Awards and prizes",
    hint: "Prizes, ranks, scholarships",
    title: { label: "Award", placeholder: "First prize, Technovate 2026" },
    org: { label: "Given by", placeholder: "HKBK College of Engineering" },
    years: "year",
    link: false,
    detail: true
  },
  languages: {
    label: "Languages",
    hint: "Languages you speak",
    title: { label: "Language", placeholder: "Kannada" },
    org: { label: "How well", placeholder: "" },
    years: null,
    link: false,
    detail: false,
    levels: ["Native", "Fluent", "Conversational", "Basic"]
  }
};

export const SECTION_LIMITS = { entries: 10, title: 90, org: 90, detail: 300, link: 200 } as const;

export const emptyEntry = (kind: SectionKind): SectionEntry => ({
  title: "",
  org: SECTIONS[kind].levels?.[1] ?? "",
  from: SECTIONS[kind].years ? new Date().getFullYear() : null,
  to: null,
  current: false,
  link: "",
  detail: ""
});

/** "2019 – 2023", "2021 – now", "2024", or nothing. */
export function yearsOf(entry: SectionEntry, kind: SectionKind): string {
  const years = SECTIONS[kind].years;
  if (!years || !entry.from) return "";
  if (years === "year") return String(entry.from);
  if (entry.current) return `${entry.from} – now`;
  return !entry.to || entry.to === entry.from ? String(entry.from) : `${entry.from} – ${entry.to}`;
}
