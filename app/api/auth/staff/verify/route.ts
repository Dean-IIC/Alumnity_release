import { NextResponse } from "next/server";
import { readJson, respond, text } from "../../../../../lib/server/http";
import { checkStaffCode } from "../../../../../lib/server/staff";

/** Staff join, step 2: the code from the email. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return respond(await checkStaffCode(text(body.ticket, 64), text(body.code, 12)));
}
