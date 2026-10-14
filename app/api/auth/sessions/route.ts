import { NextResponse } from "next/server";
import { endOtherSessions } from "../../../../lib/server/auth";
import { readJson, respond, signedIn } from "../../../../lib/server/http";

/** Signs out everywhere else. */
export async function POST(request: Request) {
  const me = signedIn(request);
  if (me instanceof NextResponse) return me;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return respond(endOtherSessions(me.user.id, me.token));
}
