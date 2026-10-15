import { NextResponse } from "next/server";
import { signedInUser } from "../../../../lib/server/auth";
import { publicUser } from "../../../../lib/server/http";

/** Who's signed in, for the header. Never cached. */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await signedInUser();
  return NextResponse.json({ user: user ? publicUser(user) : null }, { headers: { "cache-control": "no-store" } });
}
