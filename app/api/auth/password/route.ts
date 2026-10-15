import { NextResponse } from "next/server";
import { changePassword } from "../../../../lib/server/auth";
import { readJson, respond, signedIn, text } from "../../../../lib/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  return respond(await changePassword(me.user, text(body.current, 400), text(body.password, 400)));
}
