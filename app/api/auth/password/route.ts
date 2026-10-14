import { NextResponse } from "next/server";
import { changePassword } from "../../../../lib/server/auth";
import { readJson, respond, signedIn, text } from "../../../../lib/server/http";

export async function POST(request: Request) {
  const me = signedIn(request);
  if (me instanceof NextResponse) return me;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return respond(await changePassword(me.user.id, text(body.current, 400), text(body.password, 400), me.token));
}
