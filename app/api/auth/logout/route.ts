import { NextResponse } from "next/server";
import { endSession } from "../../../../lib/server/auth";
import { readJson, SESSION_COOKIE } from "../../../../lib/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const token = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  endSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
