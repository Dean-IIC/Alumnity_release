import { NextResponse } from "next/server";
import { parseProfile, saveProfile } from "../../../lib/server/profile";
import { readJson, signedIn } from "../../../lib/server/http";
import { withinLimit } from "../../../lib/server/throttle";

/** Saves your page. Only yours: who you are comes from your session, never from the form. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  // Plenty for anyone editing their page; not a script rewriting it all day.
  if (!(await withinLimit(`profile:${me.user.id}`, 60, 60 * 60_000))) return NextResponse.json({ ok: false, error: "You have saved your page many times in the last hour. Try again later." }, { status: 429 });
  const parsed = await parseProfile(body, me.user.id);
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  await saveProfile(me.user.id, parsed.profile);
  return NextResponse.json({ ok: true });
}
