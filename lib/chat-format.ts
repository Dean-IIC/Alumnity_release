/*
 * How Messages writes times and previews: short, as chat apps do ("3h", "Yesterday",
 * "4:05 pm"), always in India time so the server's page and the browser agree.
 */

const IST_OFFSET = 330 * 60_000; // India keeps one offset all year (no summer time)
const DAY = 24 * 60 * 60_000;
const IST = "Asia/Kolkata";

/** The calendar day in India, as a number (days since 1970), for "Today" and "Yesterday". */
const istDay = (at: number) => Math.floor((at + IST_OFFSET) / DAY);

/** "4:05 pm". */
export const clockTime = (at: number) => new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST }).toLowerCase();

/** The line between days in a conversation: "Today", "Yesterday", "Monday" (this week), or "12 Oct 2026". */
export function dayLabel(at: number, now = Date.now()): string {
  const days = istDay(now) - istDay(at);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(at).toLocaleDateString("en-IN", { weekday: "long", timeZone: IST });
  return new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
}

/** A conversation's age in the list: "now", "5m", "3h", "2d", "3w", then the date. */
export function shortAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 35) return `${Math.floor(d / 7)}w`;
  return new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
}

/** How long after sending a message its sender may still edit it (as WhatsApp allows). */
export const MESSAGE_EDIT_WINDOW = 15 * 60_000;

/**
 * The last message, as the conversation list shows it. Story replies say so, as Instagram's
 * do; one deleted for everyone says only that (its words are gone).
 */
export function previewOf(c: { last: string; mine: boolean; story: "reply" | "reaction" | null; deleted?: boolean }): string {
  if (c.deleted) return c.mine ? "You deleted a message" : "Message deleted";
  const text = c.last.replace(/\s+/g, " ").trim();
  if (c.story === "reaction") return c.mine ? `You reacted ${text} to their story` : `Reacted ${text} to your story`;
  if (c.story === "reply") return c.mine ? `You replied to their story: ${text}` : `Replied to your story: ${text}`;
  return c.mine ? `You: ${text}` : text;
}
