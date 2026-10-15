import { NextResponse } from "next/server";
import { deleteAccount, logOut } from "../../../../lib/server/auth";
import { readJson, signedIn, text } from "../../../../lib/server/http";

/** Deletes your account, with your password as proof. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const outcome = await deleteAccount(me.user, text(body.password, 400));
  if (outcome.ok) await logOut();
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 400 });
}
