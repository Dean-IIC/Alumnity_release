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
 *
 *   GET /api/health                       this instance, the database, Supabase's auth server
 *   GET /api/health?as=<member's email>   and Home's own loading, as that member would see it
 *
 * Home's loading here mirrors app/(member)/layout.tsx, app/(member)/home/page.tsx and
 * components/home/role-focus.tsx: change those, change this.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

/** The slowest queries, and how many ran at once at worst. */
function summary(queries: Timed[]) {
  const slowest = [...queries].sort((a, b) => b.ms - a.ms).slice(0, 8);
  let mostAtOnce = 0;
  for (const q of queries) mostAtOnce = Math.max(mostAtOnce, queries.filter((o) => o.at <= q.at && o.at + o.ms > q.at).length);
  return { queries: queries.length, mostAtOnce, slowest };
}

export async function GET(request: Request) {
  if (!allowed(request)) return new NextResponse("Not allowed", { status: 401 });
  const coldDatabase = !opened();
  const instance = { region: process.env.VERCEL_REGION ?? "local", ageMs: Date.now() - bootedAt, call: ++calls, coldDatabase };

  // The database: the first query (which opens the connection, if this instance hasn't), then round trips.
  const first = await ms(() => db().one("select 1"));
  const trips: number[] = [];
  for (let i = 0; i < 5; i++) trips.push(await ms(() => db().one("select 1")));
  const tenAtOnce = await ms(() => Promise.all(Array.from({ length: 10 }, () => db().one("select 1"))));
  const database = { firstQueryMs: first, roundTripsMs: trips, tenAtOnceMs: tenAtOnce };

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

  const as = new URL(request.url).searchParams.get("as")?.trim().toLowerCase();
  if (!as) return NextResponse.json({ instance, database, auth });

  const row = await db().one("select * from users where lower(email) = ?", as);
  if (!row) return NextResponse.json({ instance, database, auth, home: "no member with that email" });
  const me = toUser(row);
  const home = await traced(() => homeLoading(me));
  return NextResponse.json({ instance, database, auth, home: { role: me.role, totalMs: home.ms, steps: home.result, ...summary(home.queries) } });
}

/** Home's loading, step by step (each step waits for the one before, as on the page). */
async function homeLoading(me: User) {
  const steps: Record<string, number> = {};
  const step = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
    const began = performance.now();
    try {
      return await work();
    } finally {
      steps[name] = Math.round(performance.now() - began);
    }
  };
  // The layout (alongside the page).
  const layout = step("layout: counts and photo", () =>
    Promise.all([waitingRequests(me.id), unreadMessages(me.id), unreadNotifications(me.id), photoIdsOf([me.id])])
  );
  const [, posts] = await step("page: everything at once", () =>
    Promise.all([
      profileOf(me.id),
      feedFor(me, { limit: 15, scope: "all" }),
      storyBar(me),
      batchmates(me),
      relationsOf(me.id),
      eventsFor(me),
      activeAnnouncements(),
      settings(),
      connectionCount(me.id),
      followCounts(me.id),
      groupsFor(me),
      liveCauses(me, 2),
      peopleToMeet(me, 6)
    ])
  );
  await step("page: photos", () => photoIdsOf([me.id, ...posts.flatMap((p) => [p.author.id, ...p.comments.map((c) => c.author.id)])]));
  if (isModerator(me)) await step("page: desk steps", () => deskBeginnings());
  await step("focus", (): Promise<unknown> =>
    isModerator(me)
      ? Promise.all([stats(me), reports(me, "open"), weekInNumbers(), settings(), auditLog(me, { limit: 5 })])
      : me.role === "student"
        ? Promise.all([mentorsFor(me, 4), asksFor(me)])
        : Promise.all([asksFor(me), profileOf(me.id), studentsSeeking(me, 3), batchmates(me)])
  );
  await layout;
  return steps;
}
