import { NextResponse } from "next/server";
import { prefsOf, pushCount, pushReady, removePushSubscription, savePrefs, savePushSubscription, vapidPublicKey } from "../../../lib/server/alerts";
import { readJson, signedIn } from "../../../lib/server/http";
import { withinLimit } from "../../../lib/server/throttle";

/*
 * Your alerts: GET what's set (and the key a browser needs to subscribe); POST
 * { emailDigest, push } to change your choices, { subscribe: <PushSubscription> } to turn
 * this browser's notifications on, or { unsubscribe: <endpoint> } to turn them off.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const [prefs, browsers] = await Promise.all([prefsOf(me.user.id), pushCount(me.user.id)]);
  return NextResponse.json({ ok: true, ...prefs, browsers, pushKey: pushReady() ? vapidPublicKey() : null }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  if (!(await withinLimit(`alerts:${me.user.id}`, 30, 60 * 60_000))) return NextResponse.json({ ok: false, error: "You have made too many changes. Try again later." }, { status: 429 });
  if ("subscribe" in body) {
    const saved = await savePushSubscription(me.user.id, body.subscribe);
    return NextResponse.json(saved ? { ok: true } : { ok: false, error: "We couldn't turn on notifications for this browser." }, { status: saved ? 200 : 400 });
  }
  if (typeof body.unsubscribe === "string") {
    await removePushSubscription(me.user.id, body.unsubscribe.slice(0, 1000));
    return NextResponse.json({ ok: true });
  }
  const now = await prefsOf(me.user.id);
  await savePrefs(me.user.id, {
    emailDigest: typeof body.emailDigest === "boolean" ? body.emailDigest : now.emailDigest,
    push: typeof body.push === "boolean" ? body.push : now.push
  });
  return NextResponse.json({ ok: true });
}
