import { NextResponse } from "next/server";
import { logOut } from "../../../../lib/server/auth";
import { readJson } from "../../../../lib/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  await logOut();
  return NextResponse.json({ ok: true });
}
