import { NextResponse } from "next/server";
import { checkUnsubscribe, stopDigest } from "../../../../lib/server/digest";

/*
 * The "stop these emails" link in the daily digest (and mail apps' one-click unsubscribe).
 * Signed per member, so a link only ever turns off its own member's emails.
 */
export const dynamic = "force-dynamic";

async function stop(request: Request) {
  const params = new URL(request.url).searchParams;
  const userId = Number(params.get("u"));
  if (!Number.isSafeInteger(userId) || !checkUnsubscribe(userId, params.get("t") ?? "")) return null;
  await stopDigest(userId);
  return userId;
}

const page = (text: string) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Alumnity</title><body style="font-family:Georgia,serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><p>${text}</p><p><a href="/settings">Settings</a> · <a href="/home">Alumnity</a></p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

export async function GET(request: Request) {
  return (await stop(request)) ? page("Done: no more daily emails. You can turn them back on in Settings.") : page("That link doesn't work any more. Turn the emails off in Settings instead.");
}

/** Mail apps' one-click unsubscribe (RFC 8058). */
export async function POST(request: Request) {
  return (await stop(request)) ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 400 });
}
