import { db } from "./db";
import type { User } from "./auth";
import { isBranch } from "../branches";
import { firstName } from "../format";
import { blockIds, blockedEitherWay, membersByIds, relation } from "./people";
import { isModerator, isSenior } from "./roles";
import { PAUSED, settings } from "./settings";
import { notify, type Result } from "./social";
import { withinLimit } from "./throttle";

/*
 * Jobs and referrals: alumni and staff put up openings (a job or an internship, usually
 * where they work); students and alumni ask them for a referral, with a line about why
 * they fit. When the poster says yes, the two are connected, so they can talk it through
 * in Messages. Only the poster (and the college desk) sees who asked.
 */

export const OPENING_LIMITS = { title: 120, company: 80, place: 80, body: 2000, link: 300, note: 600 } as const;
/** How long an opening stays up, in days (the poster picks one). */
export const OPEN_FOR = [7, 14, 30, 60] as const;
const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });

export type OpeningKind = "job" | "internship";

export type Opening = {
  id: number;
  poster: User | null;
  kind: OpeningKind;
  title: string;
  company: string;
  place: string;
  branch: string | null;
  link: string | null;
  body: string;
  canRefer: boolean;
  closesAt: number;
  /** Taken down, or past its closing day. */
  closed: boolean;
  createdAt: number;
  mine: boolean;
  /** How many asked for a referral (shown to the poster and the desk only; 0 to others). */
  requests: number;
  /** The viewer's own request, if they made one. */
  myRequest: { at: number; accepted: boolean } | null;
};

type Row = {
  id: number;
  poster: number;
  kind: OpeningKind;
  title: string;
  company: string;
  place: string;
  branch: string | null;
  link: string | null;
  body: string;
  can_refer: number;
  closes_at: number;
  closed_at: number | null;
  created_at: number;
};

/** Who may put one up: those who've finished at HKBK, or work there (not students). */
export const canPostOpening = (u: Pick<User, "role">) => isSenior(u);

const safeLink = (s: string) => {
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

async function toOpenings(rows: Row[], viewer: User): Promise<Opening[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const q = ids.map(() => "?").join(",");
  const [posters, counts, mine] = await Promise.all([
    membersByIds(rows.map((r) => r.poster)),
    db().all<{ opening_id: number; n: number }>(`select opening_id, count(*) as n from referral_requests where opening_id in (${q}) group by opening_id`, ...ids),
    db().all<{ opening_id: number; created_at: number; accepted_at: number | null }>(
      `select opening_id, created_at, accepted_at from referral_requests where requester = ? and opening_id in (${q})`,
      viewer.id,
      ...ids
    )
  ]);
  const count = new Map(counts.map((c) => [c.opening_id, Number(c.n)]));
  const asked = new Map(mine.map((r) => [r.opening_id, { at: r.created_at, accepted: r.accepted_at !== null }]));
  const now = Date.now();
  return rows.map((r) => {
    const isMine = r.poster === viewer.id;
    return {
      id: r.id,
      poster: posters.get(r.poster) ?? null,
      kind: r.kind,
      title: r.title,
      company: r.company,
      place: r.place,
      branch: r.branch,
      link: r.link,
      body: r.body,
      canRefer: r.can_refer === 1,
      closesAt: r.closes_at,
      closed: r.closed_at !== null || r.closes_at < now,
      createdAt: r.created_at,
      mine: isMine,
      requests: isMine || isModerator(viewer) ? (count.get(r.id) ?? 0) : 0,
      myRequest: asked.get(r.id) ?? null
    };
  });
}

export async function createOpening(
  me: User,
  input: { kind: string; title: string; company: string; place: string; branch: string; link: string; body: string; canRefer: boolean; days: string }
): Promise<Result & { id?: number }> {
  if (!canPostOpening(me)) return no("Openings are put up by alumni and staff. You can ask for a referral on any of them.");
  if (!(await settings()).features.openings) return no(PAUSED);
  const kind = input.kind === "internship" ? "internship" : input.kind === "job" ? "job" : null;
  const title = input.title.trim().slice(0, OPENING_LIMITS.title);
  const company = input.company.trim().slice(0, OPENING_LIMITS.company);
  const place = input.place.trim().slice(0, OPENING_LIMITS.place);
  const body = input.body.trim().slice(0, OPENING_LIMITS.body);
  const branch = input.branch ? (isBranch(input.branch) ? input.branch : undefined) : null;
  const link = input.link.trim() ? safeLink(input.link.trim().slice(0, OPENING_LIMITS.link)) : null;
  const days = Number(input.days || 30);
  if (!kind) return no("Choose a job or an internship.");
  if (!title) return no("Give the role a name, e.g. “Graduate engineer trainee”.");
  if (!company) return no("Say which company it's at.");
  if (branch === undefined) return no("Choose a branch from the list, or any branch.");
  if (input.link.trim() && !link) return no("The link should start with https://");
  if (!(OPEN_FOR as readonly number[]).includes(days)) return no("Choose how long it stays up.");
  if (!(await withinLimit(`opening:${me.id}`, 5, DAY))) return no("That's five openings today: the most in a day.");
  const now = Date.now();
  const row = await db().one<{ id: number }>(
    "insert into openings (poster, kind, title, company, place, branch, link, body, can_refer, closes_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning id",
    me.id,
    kind,
    title,
    company,
    place,
    branch,
    link,
    body,
    input.canRefer ? 1 : 0,
    now + days * DAY,
    now
  );
  return { ok: true, id: row!.id };
}

/** Open openings (newest first), narrowed to a kind or a branch; and the viewer's own, open or not. */
export async function openingsFor(viewer: User, filter: { kind?: string; branch?: string } = {}): Promise<{ open: Opening[]; mine: Opening[] }> {
  const blocked = [...(await blockIds(viewer.id))];
  const where = ["closed_at is null", "closes_at >= ?"];
  const args: unknown[] = [Date.now()];
  if (filter.kind === "job" || filter.kind === "internship") {
    where.push("kind = ?");
    args.push(filter.kind);
  }
  if (filter.branch && isBranch(filter.branch)) {
    where.push("(branch is null or branch = ?)");
    args.push(filter.branch);
  }
  if (blocked.length) {
    where.push(`poster not in (${blocked.map(() => "?").join(",")})`);
    args.push(...blocked);
  }
  const [open, mine] = await Promise.all([
    db().all<Row>(`select * from openings where ${where.join(" and ")} order by created_at desc limit 100`, ...args),
    db().all<Row>("select * from openings where poster = ? order by created_at desc limit 50", viewer.id)
  ]);
  const [o, m] = await Promise.all([toOpenings(open, viewer), toOpenings(mine, viewer)]);
  return { open: o, mine: m };
}

/** The newest open openings that suit someone's branch (for Home). */
export async function openingsForHome(viewer: User, limit = 3): Promise<Opening[]> {
  const { open } = await openingsFor(viewer, viewer.branch ? { branch: viewer.branch } : {});
  return open.filter((o) => !o.mine).slice(0, limit);
}

export async function openingById(viewer: User, id: number): Promise<Opening | null> {
  if (!Number.isSafeInteger(id)) return null;
  const row = await db().one<Row>("select * from openings where id = ?", id);
  if (!row) return null;
  // Not for someone the poster blocked, or who blocked them (the desk still sees it).
  if (!isModerator(viewer) && row.poster !== viewer.id && (await blockedEitherWay(viewer.id, row.poster))) return null;
  return (await toOpenings([row], viewer))[0];
}

export async function requestReferral(me: User, id: number, note: string): Promise<Result> {
  if (!(await settings()).features.openings) return no(PAUSED);
  const opening = await openingById(me, id);
  if (!opening || !opening.poster) return no("That opening isn't here any more.");
  if (opening.mine) return no("That's your own opening.");
  if (opening.closed) return no("This opening has closed.");
  if (!opening.canRefer) return no("The person who put this up isn't taking referral requests. Use the link to apply.");
  if (opening.myRequest) return no("You've already asked. They'll see it on the opening.");
  const why = note.trim().slice(0, OPENING_LIMITS.note);
  if (why.length < 20) return no("Write a line or two about why you fit: your branch, skills, a project.");
  if (!(await withinLimit(`referral:${me.id}`, 10, DAY))) return no("That's ten referral requests today. Try again tomorrow.");
  const added = await db().run(
    "insert into referral_requests (opening_id, requester, note, created_at) values (?, ?, ?, ?) on conflict do nothing",
    id,
    me.id,
    why,
    Date.now()
  );
  if (!added) return no("You've already asked. They'll see it on the opening.");
  await notify(opening.poster.id, { actor: me.id, kind: "referral-request", text: `${me.name} asked you for a referral: ${opening.title} at ${opening.company}.`, link: `/openings/${id}` });
  return { ok: true };
}

export type ReferralRequest = { requester: User; note: string; at: number; accepted: boolean };

/** Who asked, for the poster and the college desk; nobody else sees them. */
export async function referralRequests(viewer: User, id: number): Promise<ReferralRequest[]> {
  const row = await db().one<{ poster: number }>("select poster from openings where id = ?", id);
  if (!row || (row.poster !== viewer.id && !isModerator(viewer))) return [];
  const rows = await db().all<{ requester: number; note: string; created_at: number; accepted_at: number | null }>(
    "select requester, note, created_at, accepted_at from referral_requests where opening_id = ? order by created_at",
    id
  );
  const people = await membersByIds(rows.map((r) => r.requester));
  return rows.flatMap((r) => {
    const requester = people.get(r.requester);
    return requester ? [{ requester, note: r.note, at: r.created_at, accepted: r.accepted_at !== null }] : [];
  });
}

/** The poster says yes: the request is marked, and the two are connected so they can talk. */
export async function acceptReferral(me: User, id: number, requesterId: number): Promise<Result> {
  const opening = await openingById(me, id);
  if (!opening || !opening.mine) return no("Only the person who put this up can answer.");
  const request = await db().one<{ accepted_at: number | null }>("select accepted_at from referral_requests where opening_id = ? and requester = ?", id, requesterId);
  if (!request) return no("That request isn't here any more.");
  if (request.accepted_at !== null) return { ok: true };
  const rel = await relation(me.id, requesterId);
  if (rel === "blocked" || rel === "blocked-by") return no("You can't connect with this member.");
  const now = Date.now();
  await db().tx(async (t) => {
    await t.run("update referral_requests set accepted_at = ? where opening_id = ? and requester = ?", now, id, requesterId);
    if (rel !== "connected") {
      // They asked and you said yes: that's both of you agreeing, so no second request.
      await t.run("delete from connections where (requester = ? and addressee = ?) or (requester = ? and addressee = ?)", me.id, requesterId, requesterId, me.id);
      await t.run(
        "insert into connections (requester, addressee, status, note, created_at, responded_at) values (?, ?, 'accepted', ?, ?, ?)",
        requesterId,
        me.id,
        `Referral: ${opening.title}`.slice(0, 280),
        now,
        now
      );
    }
  });
  await notify(requesterId, {
    actor: me.id,
    kind: "referral-accepted",
    text: `${firstName(me.name)} will help with your referral for ${opening.title} at ${opening.company}. You can message them now.`,
    link: `/messages/${me.id}`
  });
  return { ok: true };
}

/** Taken down early, by the poster or the college desk. */
export async function closeOpening(me: User, id: number): Promise<Result> {
  const opening = await openingById(me, id);
  if (!opening) return no("That opening isn't here any more.");
  if (!opening.mine && !isModerator(me)) return no("Only the person who put it up can take it down.");
  await db().run("update openings set closed_at = ? where id = ? and closed_at is null", Date.now(), id);
  return { ok: true };
}
