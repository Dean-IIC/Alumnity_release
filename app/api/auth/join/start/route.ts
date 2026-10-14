import { NextResponse } from "next/server";
import { startJoin } from "../../../../../lib/server/auth";
import { clientIp, readJson, respond, text } from "../../../../../lib/server/http";

/** Join, step 1: the register check again, here on the server, then a code to the email. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const outcome = await startJoin({
    name: text(body.name, 120),
    usn: text(body.usn, 20) || undefined,
    branch: text(body.branch, 10) || undefined,
    year: Number(body.year) || undefined,
    email: text(body.email, 254),
    ip: clientIp(request)
  });
  return respond(outcome);
}
