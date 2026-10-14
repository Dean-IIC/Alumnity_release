import { NextResponse } from "next/server";
import { deleteAccount } from "../../../../lib/server/auth";
import { readJson, SESSION_COOKIE, signedIn, text } from "../../../../lib/server/http";

/** Deletes your account, with your password as proof. */
export async function POST(request: Request) {
  const me = signedIn(request);
  if (me instanceof NextResponse) return me;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const outcome = await deleteAccount(me.user.id, text(body.password, 400));
  const response = NextResponse.json(outcome, { status: outcome.ok ? 200 : 400 });
  if (outcome.ok) response.cookies.delete(SESSION_COOKIE);
  return response;
}
