import { NextResponse } from "next/server";
import { eventById, eventIcs } from "../../../../lib/server/events";
import { signedIn } from "../../../../lib/server/http";

/** The event as a calendar file. Members only, like the event page. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = signedIn(request);
  if (session instanceof NextResponse) return session;
  const id = Number((await params).id);
  const event = Number.isSafeInteger(id) && id > 0 ? eventById(session.user, id) : null;
  if (!event) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(eventIcs(event, new URL(request.url).origin), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="alumnity-event-${event.id}.ics"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
