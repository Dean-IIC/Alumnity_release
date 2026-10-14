import { NextResponse } from "next/server";
import { logIn } from "../../../../lib/server/auth";
import { clientIp, readJson, respond, text } from "../../../../lib/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const outcome = await logIn(text(body.email, 254), text(body.password, 400), clientIp(request));
  return respond(outcome, outcome.ok ? outcome : undefined);
}
