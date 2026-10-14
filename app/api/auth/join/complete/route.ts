import { NextResponse } from "next/server";
import { completeJoin } from "../../../../../lib/server/auth";
import { readJson, respond, text } from "../../../../../lib/server/http";

/** Join, step 3: the password. The account is made and you're signed in. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const outcome = await completeJoin(text(body.ticket, 64), text(body.password, 400));
  return respond(outcome, outcome.ok ? outcome : undefined);
}
