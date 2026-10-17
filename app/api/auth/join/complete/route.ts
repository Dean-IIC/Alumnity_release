import { NextResponse } from "next/server";
import { completeJoin } from "../../../../../lib/server/auth";
import { readJson, joinStep, text } from "../../../../../lib/server/http";

/** Join, step 3: the password. The account is made and you're signed in. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  return joinStep("join complete", () => completeJoin(text(body.ticket, 64), text(body.password, 400)));
}
