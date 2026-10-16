import { NextResponse } from "next/server";
import { clientIp, readJson, respond, text } from "../../../../../lib/server/http";
import { startStaffJoin } from "../../../../../lib/server/staff";

/** Staff join, step 1: the invited email gets a code. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return respond(await startStaffJoin(text(body.email, 254), clientIp(request)));
}
