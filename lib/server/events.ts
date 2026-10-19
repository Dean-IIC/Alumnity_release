import { db } from "./db";
import type { User } from "./auth";
import { membersByIds } from "./people";
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

/** Events with who's organising, how many are going and whether the viewer is: four queries for any number. */
async function toEvents(rows: EventRow[], viewer: User): Promise<Event[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const q = ids.map(() => "?").join(",");
  const [organisers, counts, mine] = await Promise.all([
    membersByIds(rows.map((r) => r.organiser)),
    db().all<{ event_id: number; n: number }>(`select event_id, count(*) as n from rsvps where event_id in (${q}) group by event_id`, ...ids),
    db().all<{ event_id: number }>(`select event_id from rsvps where user_id = ? and event_id in (${q})`, viewer.id, ...ids)
  ]);
  const going = new Map(counts.map((c) => [c.event_id, c.n]));
  const imGoing = new Set(mine.map((r) => r.event_id));
  return rows.map((row) => ({
    id: row.id,
    organiser: organisers.get(row.organiser) ?? null,
    title: row.title,
    body: row.body,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    place: row.place,
    onlineLink: row.online_link,
    capacity: row.capacity,
    cancelled: row.cancelled_at != null,
    going: going.get(row.id) ?? 0,
    imGoing: imGoing.has(row.id),
    mine: row.organiser === viewer.id
  }));
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

export async function createEvent(
  me: User,
  input: { title: string; body: string; startsAt: string; endsAt: string; place: string; onlineLink: string; capacity: string }
): Promise<Result & { id?: number }> {
  if (!canOrganise(me)) return no("Events are put up by faculty and the alumni coordinators.");
  if (!(await settings()).features.events) return no(PAUSED);
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
  if (!(await withinLimit(`event:${me.id}`, 10, DAY))) return no("That's ten events today: the most in a day.");
  const row = await db().one<{ id: number }>(
    "insert into events (organiser, title, body, starts_at, ends_at, place, online_link, capacity, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning id",
    me.id,
    title,
    body,
    starts,
    ends,
    place,
    link,
    capacity,
    Date.now()
  );
  return { ok: true, id: row!.id };
}

export async function eventsFor(viewer: User): Promise<{ upcoming: Event[]; past: Event[] }> {
  const now = Date.now();
  const [upcoming, past] = await Promise.all([
    db().all<EventRow>("select * from events where coalesce(ends_at, starts_at) >= ? order by starts_at limit 200", now),
    db().all<EventRow>("select * from events where coalesce(ends_at, starts_at) < ? order by starts_at desc limit 20", now)
  ]);
  const [u, p] = await Promise.all([toEvents(upcoming, viewer), toEvents(past, viewer)]);
  return { upcoming: u, past: p };
}

export async function eventById(viewer: User, id: number): Promise<Event | null> {
  if (!Number.isSafeInteger(id)) return null;
  const row = await db().one<EventRow>("select * from events where id = ?", id);
  return row ? (await toEvents([row], viewer))[0] : null;
}

/** Who's coming, for the organiser (and the college desk). */
export async function attendees(viewer: User, id: number): Promise<User[]> {
  const row = await db().one<{ organiser: number }>("select organiser from events where id = ?", id);
  if (!row || (row.organiser !== viewer.id && !isModerator(viewer))) return [];
  const rows = await db().all<{ user_id: number }>("select user_id from rsvps where event_id = ? order by created_at", id);
  const members = await membersByIds(rows.map((r) => r.user_id));
  return rows.flatMap((r) => members.get(r.user_id) ?? []);
}

export async function toggleRsvp(me: User, id: number): Promise<Result> {
  const event = await eventById(me, id);
  if (!event) return no("That event isn't here.");
  if (event.imGoing) {
    await db().run("delete from rsvps where event_id = ? and user_id = ?", id, me.id);
    return { ok: true };
  }
  if (event.cancelled) return no("This event was cancelled.");
  if ((event.endsAt ?? event.startsAt) < Date.now()) return no("This event is over.");
  // The capacity is checked in the same statement, so two people can't take the last place.
  const added = await db().run(
    "insert into rsvps (event_id, user_id, created_at) select ?, ?, ? where (select capacity from events where id = ?) is null or (select count(*) from rsvps where event_id = ?) < (select capacity from events where id = ?) on conflict do nothing",
    id,
    me.id,
    Date.now(),
    id,
    id,
    id
  );
  if (!added && event.capacity !== null) return no("It's full, sorry.");
  return { ok: true };
}

export async function cancelEvent(me: User, id: number): Promise<Result> {
  const event = await eventById(me, id);
  if (!event) return no("That event isn't here.");
  if (!event.mine && !isModerator(me)) return no("Only its organiser can cancel it.");
  const changes = await db().run("update events set cancelled_at = ? where id = ? and cancelled_at is null", Date.now(), id);
  if (!changes) return { ok: true }; // already cancelled: everyone was told then
  for (const u of await attendees(me, id)) await notify(u.id, { actor: me.id, kind: "event-cancelled", text: `“${event.title}” was cancelled.`, link: `/events/${id}` });
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

/** How many events someone has put up (for Home's getting-started steps). */
export async function organisedCount(userId: number): Promise<number> {
  return (await db().one<{ n: number }>("select count(*) as n from events where organiser = ?", userId))?.n ?? 0;
}

/** What's coming up, for the public landing: a title, a date and a place (nothing about who's going). */
export async function upcomingForEveryone(limit = 3): Promise<{ id: number; title: string; startsAt: number; place: string }[]> {
  const rows = await db().all<{ id: number; title: string; starts_at: number; place: string }>(
    "select id, title, starts_at, place from events where cancelled_at is null and coalesce(ends_at, starts_at) >= ? order by starts_at limit ?",
    Date.now(),
    limit
  );
  return rows.map((r) => ({ id: r.id, title: r.title, startsAt: Number(r.starts_at), place: r.place }));
}
