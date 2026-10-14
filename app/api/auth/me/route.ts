import { NextResponse } from "next/server";
import { userForSession } from "../../../../lib/server/auth";
import { publicUser, SESSION_COOKIE } from "../../../../lib/server/http";

/** Who's signed in, for the header. Never cached. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  const user = userForSession(token);
  return NextResponse.json({ user: user ? publicUser(user) : null }, { headers: { "cache-control": "no-store" } });
}
