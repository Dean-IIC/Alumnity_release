import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { toUser, type User } from "../../../lib/server/auth";
import { activeAnnouncements } from "../../../lib/server/announcements";
import { asksFor } from "../../../lib/server/asks";
import { liveCauses } from "../../../lib/server/causes";
import { db, opened, traced, type Timed } from "../../../lib/server/db";
import { auditLog, reports, stats } from "../../../lib/server/desk";
import { eventsFor } from "../../../lib/server/events";
import { followCounts } from "../../../lib/server/follows";
import { groupsFor } from "../../../lib/server/groups";
import { deskBeginnings, mentorsFor, studentsSeeking, weekInNumbers } from "../../../lib/server/home";
import { batchmates, peopleToMeet, relationsOf } from "../../../lib/server/people";
import { feedFor } from "../../../lib/server/posts";
import { photoIdsOf, profileOf } from "../../../lib/server/profile";
import { isModerator } from "../../../lib/server/roles";
import { settings } from "../../../lib/server/settings";
import { connectionCount, unreadMessages, unreadNotifications, waitingRequests } from "../../../lib/server/social";
import { storyBar } from "../../../lib/server/stories";

/*
 * Where a page's time goes on the live site, for whoever runs it (the same secret as the
 * daily job: "Authorization: Bearer <CRON_SECRET>"). Timings only: no names, no rows.
 * Off unless ALUMNITY_HEALTH=on: a site that isn't being looked into doesn't have it.
 *
 *   GET /api/health                       this instance, the database (and its transactions), Supabase's auth server, photo copies
 *   GET /api/health?as=<member's email>   and Home's own loading, as that member would see it
 *
 * Home's loading here mirrors app/(member)/layout.tsx, app/(member)/home/page.tsx and
 * components/home/role-focus.tsx: change those, change this.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60; // LIMIT below is well inside it

const bootedAt = Date.now();
let calls = 0;

const allowed = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return Boolean(secret) && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
};

const ms = async (work: () => Promise<unknown>) => {
  const began = performance.now();
  await work();
  return Math.round(performance.now() - began);
};

/** The slowest queries, any still running, how many ran at once at worst, and any asked twice. */
function summary(queries: Timed[]) {
  const done = queries.filter((q): q is Timed & { ms: number } => q.ms !== null);
  const stillRunning = queries.filter((q) => q.ms === null).map(({ sql, at }) => ({ sql, startedAt: at }));
  const slowest = [...done].sort((a, b) => b.ms - a.ms).slice(0, 8);
  let mostAtOnce = 0;
  for (const q of queries) mostAtOnce = Math.max(mostAtOnce, queries.filter((o) => o.at <= q.at && (o.ms === null || o.at + o.ms > q.at)).length);
  // The same query asked more than once for one page: work that could be shared.
  const times = new Map<string, number>();
  for (const q of queries) times.set(q.sql, (times.get(q.sql) ?? 0) + 1);
  const repeated = [...times].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([sql, n]) => ({ sql, n }));
  return { queries: queries.length, stillRunning, mostAtOnce, slowest, repeated };
}

export async function GET(request: Request) {
  if (process.env.ALUMNITY_HEALTH !== "on") return new NextResponse("Not found", { status: 404 });
  if (!allowed(request)) return new NextResponse("Not allowed", { status: 401 });
  const coldDatabase = !opened();
  const instance = { region: process.env.VERCEL_REGION ?? "local", ageMs: Date.now() - bootedAt, call: ++calls, coldDatabase };

  // The database: the first query (which opens the connection, if this instance hasn't), then round trips.
  const first = await ms(() => db().one("select 1"));
  const trips: number[] = [];
  for (let i = 0; i < 5; i++) trips.push(await ms(() => db().one("select 1")));
  const tenAtOnce = await ms(() => Promise.all(Array.from({ length: 10 }, () => db().one("select 1"))));
  const database = { firstQueryMs: first, roundTripsMs: trips, tenAtOnceMs: tenAtOnce, transactions: await transactions() };

  // Supabase's auth server: every page checks the session with it unless the project signs with its own keys.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  let auth: Record<string, unknown> = { configured: false };
  if (url) {
    let keys: { alg?: string }[] = [];
    const jwksMs = await ms(async () => {
      keys = ((await (await fetch(`${url}/auth/v1/.well-known/jwks.json`, { headers: { apikey: key }, cache: "no-store" })).json().catch(() => ({}))) as { keys?: { alg?: string }[] }).keys ?? [];
    });
    const healthMs = await ms(() => fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, cache: "no-store" }));
    auth = {
      configured: true,
      healthMs,
      jwksMs,
      signingKeys: keys.map((k) => k.alg ?? "?"),
      // Without an asymmetric key, getClaims() asks the auth server on every request (the middleware's and the page's).
      sessionCheckGoesToAuthServer: !keys.some((k) => k.alg && k.alg !== "HS256")
    };
  }

  const photos = await photoCopies();
  const as = new URL(request.url).searchParams.get("as")?.trim().toLowerCase();
  if (!as) return NextResponse.json({ instance, database, auth, photos });

  const row = await db().one("select * from users where lower(email) = ?", as);
  if (!row) return NextResponse.json({ instance, database, auth, photos, home: "no member with that email" });
  const me = toUser(row);
  const home = await traced(() => homeLoading(me));
  return NextResponse.json({ instance, database, auth, photos, home: { role: me.role, totalMs: home.ms, ...home.result, ...summary(home.queries) } });
}

const failure = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 160);
type XactId = { id: string };

/**
 * Whether transactions work (a post, a join, a group are each written in one): two
 * statements in one see the same transaction, one that fails rolls back and frees its
 * connection, and three at once each finish. Nothing is written.
 */
async function transactions() {
  try {
    let same = false;
    const oneMs = await ms(() =>
      db().tx(async (t) => {
        const a = await t.one<XactId>("select txid_current()::text as id");
        const b = await t.one<XactId>("select txid_current()::text as id");
        same = Boolean(a?.id) && a?.id === b?.id;
      })
    );
    const rolledBack = await db()
      .tx(async (t) => {
        await t.one("select 1");
        throw new Error("on purpose");
      })
      .then(
        () => false,
        (error: unknown) => failure(error) === "on purpose"
      );
    const threeAtOnceMs = await ms(() => Promise.all(Array.from({ length: 3 }, () => db().tx((t) => t.one("select 1")))));
    const afterwardsMs = await ms(() => db().one("select 1"));
    return { ok: same && rolledBack, oneTransaction: same, oneMs, rolledBack, threeAtOnceMs, afterwardsMs };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/**
 * Whether this instance can make a photo's smaller copies (sharp, a native library, has to
 * be built for the server it runs on): without it every face on a page is the whole photo.
 * Also how many kept photos still have none (they get them the first time one's asked for).
 */
async function photoCopies() {
  try {
    const sharp = (await import("sharp")).default;
    let width = 0;
    const copyMs = await ms(async () => {
      const copy = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#123456" } }).resize({ width: 160 }).webp().toBuffer();
      width = (await sharp(copy).metadata()).width ?? 0;
    });
    const without = await db().one<{ n: number }>("select count(*) as n from media where kind = 'image' and mime <> 'image/gif' and sizes is null");
    return { ok: width === 160, copyMs, vips: sharp.versions?.vips ?? "?", photosWithoutCopies: Number(without?.n ?? 0) };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** How long one part of Home may take before it's reported as never finishing. */
const LIMIT = 20_000;

/**
 * Every part of Home's loading, each on its own and all at once (photos aside, which needs
 * the feed), so one that never finishes can't hide the others: each reports its time, its
 * error, or that it hadn't finished after LIMIT.
 */
async function homeLoading(me: User) {
  const parts: Record<string, number | string> = {};
  const part = <T>(name: string, work: () => Promise<T>): Promise<T | undefined> => {
    const began = performance.now();
    parts[name] = "not finished";
    return work().then(
      (value) => {
        parts[name] = Math.round(performance.now() - began);
        return value;
      },
      (error: unknown) => {
        parts[name] = `failed after ${Math.round(performance.now() - began)} ms: ${String((error as Error)?.message ?? error).slice(0, 160)}`;
        return undefined;
      }
    );
  };
  const desk = isModerator(me);
  const all = Promise.all([
    // The layout.
    part("layout: requests waiting", () => waitingRequests(me.id)),
    part("layout: unread messages", () => unreadMessages(me.id)),
    part("layout: unread notifications", () => unreadNotifications(me.id)),
    // The page.
    part("profileOf", () => profileOf(me.id)),
    part("feedFor", () => feedFor(me, { limit: 15, scope: "all" })).then((posts) =>
      part("photoIdsOf (feed)", () => photoIdsOf([me.id, ...(posts ?? []).flatMap((p) => [p.author.id, ...p.comments.map((c) => c.author.id)])]))
    ),
    part("storyBar", () => storyBar(me)),
    part("batchmates", () => batchmates(me)),
    part("relationsOf", () => relationsOf(me.id)),
    part("eventsFor", () => eventsFor(me)),
    part("activeAnnouncements", () => activeAnnouncements()),
    part("settings", () => settings()),
    part("connectionCount", () => connectionCount(me.id)),
    part("followCounts", () => followCounts(me.id)),
    part("groupsFor", () => groupsFor(me)),
    part("liveCauses", () => liveCauses(me, 2)),
    part("peopleToMeet", () => peopleToMeet(me, 6)),
    // The part made for who's reading.
    ...(desk
      ? [
          part("desk: deskBeginnings", () => deskBeginnings()),
          part("desk: stats", () => stats(me)),
          part("desk: reports", () => reports(me, "open")),
          part("desk: weekInNumbers", () => weekInNumbers()),
          part("desk: auditLog", () => auditLog(me, { limit: 5 }))
        ]
      : me.role === "student"
        ? [part("student: mentorsFor", () => mentorsFor(me, 4)), part("student: asksFor", () => asksFor(me))]
        : [part("asksFor", () => asksFor(me)), part("studentsSeeking", () => studentsSeeking(me, 3))])
  ]);
  const finished = await Promise.race([all.then(() => true), new Promise<false>((ok) => setTimeout(() => ok(false), LIMIT))]);
  return { finished, parts };
}
