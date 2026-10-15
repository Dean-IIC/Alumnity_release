import { NextResponse } from "next/server";
import { batchLabel } from "../../../../lib/format";
import { signedIn } from "../../../../lib/server/http";
import { searchMembers } from "../../../../lib/server/people";
import { withinLimit } from "../../../../lib/server/throttle";

/**
 * Names for @mentions, as you type: members only, by name, never anyone blocked either
 * way (search already leaves them out). Only a name, an id and a batch go back.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = signedIn(request);
  if (session instanceof NextResponse) return session;
  if (!withinLimit(`suggest:${session.user.id}`, 240, 60_000)) return NextResponse.json({ people: [] }, { status: 429 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 1) return NextResponse.json({ people: [] });
  const people = searchMembers(session.user, { q }, 8)
    .filter(({ member }) => member.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q.toLowerCase().split(/\s+/)[0])))
    .map(({ member }) => ({ id: member.id, name: member.name, batch: batchLabel(member) }));
  return NextResponse.json({ people }, { headers: { "cache-control": "private, no-store" } });
}
