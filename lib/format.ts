/** Times as people say them, in India time. */

const IST = "Asia/Kolkata";

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.round((now - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
}

export const when = (at: number) =>
  new Date(at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: IST });

/** "CSE · 2012", or "" if not known. */
export const batchLabel = (u: { branch: string | null; joined: number | null }) => [u.branch, u.joined].filter(Boolean).join(" · ");

export const ROLE_LABEL: Record<string, string> = { student: "Student", alumnus: "Alumnus", faculty: "Faculty", coordinator: "Alumni coordinator", admin: "Administrator", superadmin: "Super administrator" };
