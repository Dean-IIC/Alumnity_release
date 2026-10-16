import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDigest } from "../../../../lib/server/digest";

/*
 * The daily email run. Vercel Cron calls it (vercel.json) with
 * "Authorization: Bearer <CRON_SECRET>"; nobody else can.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) return new NextResponse("Not allowed", { status: 401 });
  const origin = process.env.SITE_URL || new URL(request.url).origin;
  return NextResponse.json(await runDigest(origin));
}
