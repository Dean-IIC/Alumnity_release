import { NextResponse } from "next/server";
import { auditCsv } from "../../../../lib/server/desk";
import { signedIn } from "../../../../lib/server/http";

/** The audit log as a spreadsheet: administrators only. */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await signedIn();
  if (session instanceof NextResponse) return session;
  const csv = await auditCsv(session.user);
  if (csv === null) return new NextResponse("Not found", { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="alumnity-audit-${day}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
