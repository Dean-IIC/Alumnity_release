import { NextResponse } from "next/server";
import { completeReset } from "../../../../../lib/server/auth";
import { readJson, respond, text } from "../../../../../lib/server/http";

/** Forgot password, step 2: the code and a new password; every other browser is signed out. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return respond(await completeReset(text(body.ticket, 64), text(body.code, 12), text(body.password, 400)));
}
