import { NextResponse } from "next/server";
import { membersCsv } from "../../../../lib/server/hq";
import { signedIn } from "../../../../lib/server/http";

/** Every member, with emails, as a spreadsheet: super administrators only (not found for everyone else). */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await signedIn();
  if (session instanceof NextResponse) return new NextResponse("Not found", { status: 404 });
  const csv = await membersCsv(session.user);
  if (csv === null) return new NextResponse("Not found", { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="alumnity-members-${day}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
