import { NextResponse } from "next/server";
import { endOtherSessions } from "../../../../lib/server/auth";
import { readJson, respond, signedIn } from "../../../../lib/server/http";

/** Signs out everywhere else. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  return respond(await endOtherSessions(me.user));
}
