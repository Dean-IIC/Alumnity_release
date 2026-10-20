import { NextResponse } from "next/server";
import { safeNext } from "../../../../lib/safe-next";
import { signedInUser } from "../../../../lib/server/auth";
import { openNotification } from "../../../../lib/server/social";

/**
 * A notification clicked: it's read from now on (no longer highlighted), and the reader goes
 * where it leads. Only the reader's own; anything else goes back to the list. The link is
 * checked as every stored link is, so it can never lead off Alumnity.
 */
export async function GET(request: Request) {
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const me = await signedInUser();
  if (!me) return back("/login?next=/notifications");
  const link = await openNotification(me.id, Number(new URL(request.url).searchParams.get("id")));
  return back(link === null ? "/notifications" : safeNext(link));
}
