import { NextResponse } from "next/server";
import type { Lookup } from "../../../lib/register";
import { clientIp } from "../../../lib/server/http";
import { findInRegister } from "../../../lib/server/register";
import { withinLimit } from "../../../lib/server/throttle";

/*
 * "Is this me in the register?" Answers only found (with your own line), not found, or
 * "tell us your USN" when a name, branch and year fit more than one person. A visitor gets
 * a handful of tries every ten minutes (counted in the database, so every server agrees),
 * so the register can't be combed through.
 */

export async function POST(request: Request) {
  if (!(await withinLimit(`register:${clientIp(request)}`, 8, 10 * 60_000))) return NextResponse.json({ status: "slow-down" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as Partial<Lookup> | null;
  const name = typeof body?.name === "string" ? body.name.slice(0, 120) : "";
  const usn = typeof body?.usn === "string" ? body.usn.slice(0, 20) : undefined;
  const branch = typeof body?.branch === "string" ? body.branch.slice(0, 10) : undefined;
  const year = Number(body?.year) || undefined;
  if (!name.trim() || (!usn && !(branch && year))) return NextResponse.json({ status: "incomplete" }, { status: 400 });

  const result = await findInRegister({ name, usn, branch, year });
  if (!result) return NextResponse.json({ status: "unavailable" }, { status: 503 });
  // Found by name, branch and year: don't hand out a USN the visitor didn't type.
  if (result.status === "found" && !usn) result.usn = `${result.usn.slice(0, 7)}•••`;
  return NextResponse.json(result);
}
