/** Times as people say them, in India time. */

const IST = "Asia/Kolkata";

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.round((now - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
}

export const when = (at: number) =>
  new Date(at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: IST });

/** "CSE · 2012", or "" if not known. */
/** A batch as colleges write it: the years from joining to finishing ("2012–16"). */
export const batchYears = (joined: number, programme?: string | null) => {
  const years = !programme || programme === "B.Tech" ? 4 : programme === "PHD" ? 5 : 2;
  return `${joined}–${String(joined + years).slice(-2)}`;
};

/** "CSE · 2012–16": a member's branch and batch (staff, with no batch: their department). */
export const batchLabel = (u: { branch: string | null; joined: number | null; programme?: string | null }) =>
  [u.branch, u.joined ? batchYears(u.joined, u.programme) : null].filter(Boolean).join(" · ");

export const ROLE_LABEL: Record<string, string> = { student: "Student", alumnus: "Alumnus", faculty: "Faculty", coordinator: "Alumni coordinator", admin: "Administrator", superadmin: "Super administrator" };

/** "₹1,25,000" from paise (₹1 = 100 paise), Indian style. */
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: paise % 100 ? 2 : 0 })}`;

/** Titles and initials that come before a first name ("Dr. Asha Rao", "K. Ramesh"). */
const BEFORE_NAME = /^(dr|prof|mr|mrs|ms|miss|er|smt|shri|sri|[a-z])\.?$/i;

/** What to call someone: their first name, past any title or initials ("Dr. K. Asha Rao" → "Asha"). */
/** "MOHAMMED IMRAN K" → "Mohammed Imran K": the register is in capitals, people aren't. */
export const nameCase = (name: string) => name.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

/** A name as people should see it: one stored all in capitals (straight from the register) in proper case; any other as written. */
export const displayName = (name: string) => (/^[A-Z][A-Z .'-]*$/.test(name.trim()) ? nameCase(name) : name);

/** "changed role" → "Changed role": text from the database shown where a sentence starts. */
export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const firstName = (name: string) => {
  const words = name.trim().split(/\s+/);
  return words.find((w) => !BEFORE_NAME.test(w)) ?? words[0] ?? "";
};
