import { NextResponse } from "next/server";
import { parseProfile, saveProfile } from "../../../lib/server/profile";
import { readJson, signedIn } from "../../../lib/server/http";

/** Saves your page. Only yours: who you are comes from your session, never from the form. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const parsed = await parseProfile(body, me.user.id);
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  await saveProfile(me.user.id, parsed.profile);
  return NextResponse.json({ ok: true });
}
