import { NextResponse } from "next/server";
import { signedIn } from "../../../lib/server/http";
import { pulseFor } from "../../../lib/server/social";

/*
 * What's new, in a few numbers: unread notifications, unread messages, requests waiting,
 * and (with ?thread=<member id>) the newest message in that conversation and the newest of
 * yours they've read. Open pages ask every so often (components/app/pulse.tsx) and only
 * redraw when one of these changes.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const other = Number(new URL(request.url).searchParams.get("thread"));
  return NextResponse.json(await pulseFor(me.user.id, other || undefined), { headers: { "cache-control": "private, no-store" } });
}
