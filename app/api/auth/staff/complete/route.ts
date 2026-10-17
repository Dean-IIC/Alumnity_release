import { NextResponse } from "next/server";
import { readJson, joinStep, text } from "../../../../../lib/server/http";
import { completeStaffJoin } from "../../../../../lib/server/staff";

/** Staff join, step 3: the password. The account is made, with the invited role. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return joinStep("staff join complete", () => completeStaffJoin(text(body.ticket, 64), text(body.password, 400)));
}
