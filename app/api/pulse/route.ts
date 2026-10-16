import { NextResponse } from "next/server";
import { db } from "../../../lib/server/db";
import { signedIn } from "../../../lib/server/http";
import { unreadMessages, unreadNotifications, waitingRequests } from "../../../lib/server/social";

/*
 * What's new, in a few numbers: unread notifications, unread messages, requests waiting,
 * and (with ?thread=<member id>) the newest message in that conversation. Open pages ask
 * every so often (components/app/pulse.tsx) and only redraw when one of these changes.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const other = Number(new URL(request.url).searchParams.get("thread"));
  const [n, m, r, latest] = await Promise.all([
    unreadNotifications(me.user.id),
    unreadMessages(me.user.id),
    waitingRequests(me.user.id),
    Number.isSafeInteger(other) && other > 0
      ? db().one<{ id: number }>(
          "select max(id) as id from messages where (sender = ? and recipient = ?) or (sender = ? and recipient = ?)",
          me.user.id,
          other,
          other,
          me.user.id
        )
      : Promise.resolve(undefined)
  ]);
  return NextResponse.json({ n, m, r, t: latest?.id ?? 0 }, { headers: { "cache-control": "private, no-store" } });
}
