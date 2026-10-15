import { database } from "./db";
import type { User } from "./auth";
import { memberById } from "./people";
import { canOrganise, isModerator } from "./roles";
import { notify, type Result } from "./social";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";

/*
 * Events: reunions, talks, college days. Faculty, coordinators and administrators put
 * them up; every member can see them and say they're coming. A capacity, if set, holds.
 */

export const EVENT_LIMITS = { title: 120, body: 3000, place: 160, link: 300 } as const;
const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });

export { canOrganise } from "./roles";

export type Event = {
  id: number;
  organiser: User | null;
  title: string;
  body: string;
  startsAt: number;
  endsAt: number | null;
  place: string;
  onlineLink: string | null;
  capacity: number | null;
  cancelled: boolean;
  going: number;
  imGoing: boolean;
  mine: boolean;
};

type EventRow = {
  id: number;
  organiser: number;
  title: string;
  body: string;
  starts_at: number;
  ends_at: number | null;
  place: string;
  online_link: string | null;
  capacity: number | null;
  cancelled_at: number | null;
};

const goingCount = (id: number) => (database().prepare("select count(*) as n from rsvps where event_id = ?").get(id) as { n: number }).n;

function toEvent(row: EventRow, viewer: User): Event {
  return {
    id: row.id,
    organiser: memberById(row.organiser),
    title: row.title,
    body: row.body,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    place: row.place,
    onlineLink: row.online_link,
    capacity: row.capacity,
    cancelled: row.cancelled_at != null,
    going: goingCount(row.id),
    imGoing: Boolean(database().prepare("select 1 from rsvps where event_id = ? and user_id = ?").get(row.id, viewer.id)),
    mine: row.organiser === viewer.id
  };
}

/** A datetime-local value ("2026-11-02T18:30"), read as India time. */
export function parseLocalTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = Date.parse(`${value}:00+05:30`);
  return Number.isFinite(at) ? at : null;
}

const safeLink = (s: string) => {
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export function createEvent(
  me: User,
  input: { title: string; body: string; startsAt: string; endsAt: string; place: string; onlineLink: string; capacity: string }
): Result & { id?: number } {
  if (!canOrganise(me)) return no("Events are put up by faculty and the alumni coordinators.");
  if (!settings().features.events) return no(PAUSED);
  const title = input.title.trim().slice(0, EVENT_LIMITS.title);
  const body = input.body.trim().slice(0, EVENT_LIMITS.body);
  const place = input.place.trim().slice(0, EVENT_LIMITS.place);
  const starts = parseLocalTime(input.startsAt);
  const ends = input.endsAt ? parseLocalTime(input.endsAt) : null;
  const link = input.onlineLink.trim() ? safeLink(input.onlineLink.trim().slice(0, EVENT_LIMITS.link)) : null;
  const capacity = input.capacity.trim() ? Math.floor(Number(input.capacity)) : null;
  if (!title) return no("Give it a name.");
  if (!place) return no("Say where it is (or “Online”).");
  if (!starts) return no("Choose when it starts.");
  if (starts < Date.now() - DAY) return no("That date has passed.");
  if (input.endsAt && (!ends || ends <= starts)) return no("It should end after it starts.");
  if (input.onlineLink.trim() && !link) return no("The online link should start with https://");
  if (capacity !== null && !(capacity > 0 && capacity <= 100_000)) return no("Capacity should be a number of people, or empty.");
  if (!withinLimit(`event:${me.id}`, 10, DAY)) return no("That's ten events today: the most in a day.");
  const { lastInsertRowid } = database()
    .prepare("insert into events (organiser, title, body, starts_at, ends_at, place, online_link, capacity, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(me.id, title, body, starts, ends, place, link, capacity, Date.now());
  return { ok: true, id: Number(lastInsertRowid) };
}

export function eventsFor(viewer: User): { upcoming: Event[]; past: Event[] } {
  const now = Date.now();
  const db = database();
  const upcoming = (db.prepare("select * from events where coalesce(ends_at, starts_at) >= ? order by starts_at").all(now) as EventRow[]).map((r) => toEvent(r, viewer));
  const past = (db.prepare("select * from events where coalesce(ends_at, starts_at) < ? order by starts_at desc limit 20").all(now) as EventRow[]).map((r) => toEvent(r, viewer));
  return { upcoming, past };
}

export function eventById(viewer: User, id: number): Event | null {
  const row = database().prepare("select * from events where id = ?").get(id) as EventRow | undefined;
  return row ? toEvent(row, viewer) : null;
}

/** Who's coming, for the organiser (and the college desk). */
export function attendees(viewer: User, id: number): User[] {
  const row = database().prepare("select organiser from events where id = ?").get(id) as { organiser: number } | undefined;
  if (!row || (row.organiser !== viewer.id && !isModerator(viewer))) return [];
  return (database().prepare("select user_id from rsvps where event_id = ? order by created_at").all(id) as { user_id: number }[])
    .map((r) => memberById(r.user_id))
    .filter((u): u is User => u !== null);
}

export function toggleRsvp(me: User, id: number): Result {
  const event = eventById(me, id);
  if (!event) return no("That event isn't here.");
  const db = database();
  if (event.imGoing) {
    db.prepare("delete from rsvps where event_id = ? and user_id = ?").run(id, me.id);
    return { ok: true };
  }
  if (event.cancelled) return no("This event was cancelled.");
  if ((event.endsAt ?? event.startsAt) < Date.now()) return no("This event is over.");
  if (event.capacity !== null && event.going >= event.capacity) return no("It's full, sorry.");
  db.prepare("insert or ignore into rsvps (event_id, user_id, created_at) values (?, ?, ?)").run(id, me.id, Date.now());
  return { ok: true };
}

export function cancelEvent(me: User, id: number): Result {
  const event = eventById(me, id);
  if (!event) return no("That event isn't here.");
  if (!event.mine && !isModerator(me)) return no("Only its organiser can cancel it.");
  const { changes } = database().prepare("update events set cancelled_at = ? where id = ? and cancelled_at is null").run(Date.now(), id);
  if (!changes) return { ok: true }; // already cancelled: everyone was told then
  for (const u of attendees(me, id)) notify(u.id, { actor: me.id, kind: "event-cancelled", text: `“${event.title}” was cancelled.`, link: `/events/${id}` });
  return { ok: true };
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

/** Calendar lines are at most 75 bytes; a longer one continues on the next line after a space. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
    }
    current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}
const icsTime = (at: number) => new Date(at).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** The event as a calendar file (.ics), for any calendar app. */
export function eventIcs(event: Event, origin: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alumnity//HKBK College of Engineering//EN",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@alumnity`,
    `DTSTAMP:${icsTime(Date.now())}`,
    `DTSTART:${icsTime(event.startsAt)}`,
    `DTEND:${icsTime(event.endsAt ?? event.startsAt + 2 * 60 * 60_000)}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(event.place)}`,
    `DESCRIPTION:${icsText(`${event.body}\n\n${origin}/events/${event.id}`)}`,
    ...(event.cancelled ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR"
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}
