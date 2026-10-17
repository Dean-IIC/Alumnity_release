import { NextResponse } from "next/server";
import { clientIp, readJson, joinStep, text } from "../../../../../lib/server/http";
import { startStaffJoin } from "../../../../../lib/server/staff";

/** Staff join, step 1: the invited email gets a code. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return joinStep("staff join start", () => startStaffJoin(text(body.email, 254), clientIp(request)));
}
