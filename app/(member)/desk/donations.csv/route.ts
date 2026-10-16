import { NextResponse } from "next/server";
import { donationsCsv } from "../../../../lib/server/causes";
import { signedIn } from "../../../../lib/server/http";

/** Every paid donation as a spreadsheet, for the college accounts: administrators only. */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await signedIn();
  if (session instanceof NextResponse) return session;
  const csv = await donationsCsv(session.user);
  if (csv === null) return new NextResponse("Not found", { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="alumnity-donations-${day}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
