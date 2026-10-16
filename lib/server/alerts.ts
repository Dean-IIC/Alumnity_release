import { db } from "./db";

/*
 * Alerts outside the site: phone (and desktop) notifications through Web Push, and a
 * daily email digest (lib/server/digest.ts). Each member can turn either off in Settings.
 *
 * Push needs VAPID keys (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT; make them with
 * `npx web-push generate-vapid-keys`). Without them, nothing is sent and Settings says so.
 * A notification carries only what the in-app one says ("New message from Asha."), never
 * a message's words.
 */

export type Prefs = { emailDigest: boolean; push: boolean };

export const pushReady = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";

export async function prefsOf(userId: number): Promise<Prefs> {
  const row = await db().one<{ email_digest: number; push: number }>("select email_digest, push from member_prefs where user_id = ?", userId);
  return { emailDigest: row ? Boolean(row.email_digest) : true, push: row ? Boolean(row.push) : true };
}

export async function savePrefs(userId: number, prefs: Prefs) {
  await db().run(
    "insert into member_prefs (user_id, email_digest, push) values (?, ?, ?) on conflict (user_id) do update set email_digest = excluded.email_digest, push = excluded.push",
    userId,
    prefs.emailDigest ? 1 : 0,
    prefs.push ? 1 : 0
  );
}

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** A browser's push subscription: only https endpoints of the push services browsers use. */
export async function savePushSubscription(userId: number, sub: unknown): Promise<boolean> {
  const s = sub as Subscription;
  if (!s || typeof s.endpoint !== "string" || !s.keys || typeof s.keys.p256dh !== "string" || typeof s.keys.auth !== "string") return false;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || s.endpoint.length > 1000 || s.keys.p256dh.length > 200 || s.keys.auth.length > 100) return false;
  // At most ten browsers each; the oldest goes.
  await db().run(
    "insert into push_subscriptions (endpoint, user_id, p256dh, auth, created_at) values (?, ?, ?, ?, ?) on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth",
    s.endpoint,
    userId,
    s.keys.p256dh,
    s.keys.auth,
    Date.now()
  );
  await db().run(
    "delete from push_subscriptions where user_id = ? and endpoint not in (select endpoint from push_subscriptions where user_id = ? order by created_at desc limit 10)",
    userId,
    userId
  );
  return true;
}

export async function removePushSubscription(userId: number, endpoint: string) {
  await db().run("delete from push_subscriptions where user_id = ? and endpoint = ?", userId, endpoint);
}

export async function pushCount(userId: number): Promise<number> {
  return (await db().one<{ n: number }>("select count(*) as n from push_subscriptions where user_id = ?", userId))?.n ?? 0;
}

/** Sends a notification to every browser `userId` turned them on in (if they still want them). */
export async function sendPush(userId: number, note: { text: string; link: string; tag?: string }) {
  if (!pushReady()) return;
  const [subs, prefs] = await Promise.all([
    db().all<{ endpoint: string; p256dh: string; auth: string }>("select endpoint, p256dh, auth from push_subscriptions where user_id = ?", userId),
    prefsOf(userId)
  ]);
  if (!subs.length || !prefs.push) return;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:alumni@hkbk.edu.in", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const payload = JSON.stringify({ title: "Alumnity", body: note.text.slice(0, 180), link: note.link, tag: note.tag ?? note.link });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 60 * 60, timeout: 5000 });
      } catch (error) {
        // Gone (the browser unsubscribed, or was reset): forget it.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db().run("delete from push_subscriptions where endpoint = ?", s.endpoint);
      }
    })
  );
}

/**
 * Sends a push without making the request wait for it: after the response is sent, where
 * the host allows (Next's after()), otherwise in the background.
 */
export async function queuePush(userId: number, note: { text: string; link: string }) {
  if (!pushReady()) return;
  const send = () => sendPush(userId, note).catch(() => undefined);
  try {
    const { after } = await import("next/server");
    after(send);
  } catch {
    void send();
  }
}
