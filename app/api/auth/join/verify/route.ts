import { NextResponse } from "next/server";
import { checkJoinCode } from "../../../../../lib/server/auth";
import { readJson, respond, text } from "../../../../../lib/server/http";

/** Join, step 2: the code from the email. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return respond(await checkJoinCode(text(body.ticket, 64), text(body.code, 12)));
}
