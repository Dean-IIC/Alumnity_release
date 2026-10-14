import { NextResponse } from "next/server";
import { startReset } from "../../../../../lib/server/auth";
import { clientIp, readJson, respond, text } from "../../../../../lib/server/http";

/** Forgot password, step 1: a code to the email (the same answer whether or not it has an account). */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return respond(await startReset(text(body.email, 254), clientIp(request)));
}
