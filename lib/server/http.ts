import { firstName } from "../format";
import { NextResponse } from "next/server";
import { signedInUser, type Outcome, type User } from "./auth";

/*
 * What every account endpoint shares: same-site only, JSON in. The session itself is
 * Supabase's cookies, set by lib/server/auth-provider.ts as each endpoint signs in or out.
 */

/**
 * Whether the browser's Origin header is this site. "null" (a sandboxed frame, a file) or
 * anything that isn't an address is simply not this site: it used to throw, a server error.
 */
function sameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Only this site may call these (a form on another site can't log someone in or out):
 * the browser's Origin header must be our own, and the body must be JSON.
 */
export async function readJson(request: Request): Promise<Record<string, unknown> | NextResponse> {
  if (!sameSite(request)) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 415 });
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : NextResponse.json({ ok: false, error: "Nothing was sent." }, { status: 400 });
}

export const text = (value: unknown, max = 200) => (typeof value === "string" ? value.slice(0, max) : "");

/** Vercel's own record of the visitor's address first: X-Forwarded-For can be written by the client behind other proxies. */
export const clientIp = (request: Request) =>
  request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";

/** What the browser may know about who's signed in: no email, no USN. */
export const publicUser = (user: User) => ({ name: user.name, firstName: firstName(user.name), role: user.role, branchName: user.branchName, joined: user.joined });

export function respond<T extends object>(outcome: Outcome<T>) {
  const { ok } = outcome;
  const body = ok ? Object.fromEntries(Object.entries(outcome).filter(([k]) => k !== "user")) : outcome;
  if (ok && "user" in outcome) Object.assign(body, { user: publicUser(outcome.user as User) });
  return NextResponse.json(body, { status: ok ? 200 : 400 });
}

/** Who's signed in on this request, or a 401 to send back. */
export async function signedIn(): Promise<{ user: User } | NextResponse> {
  const user = await signedInUser();
  return user ? { user } : NextResponse.json({ ok: false, error: "Please log in again." }, { status: 401 });
}

/** Only from this site: the browser's Origin must be our own (for uploads, which aren't JSON). */
export function fromThisSite(request: Request): NextResponse | null {
  return sameSite(request) ? null : NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
}

/**
 * A step of joining that must never fail in silence: whatever goes wrong is written to the
 * server's log with its cause (Vercel's logs name it), and the person is told plainly to try
 * again, which picks up where it stopped (lib/server/auth.ts, lib/server/staff.ts).
 */
export async function joinStep<T extends object>(label: string, work: () => Promise<Outcome<T>>) {
  try {
    return respond(await work());
  } catch (error) {
    console.error(`${label} failed:`, error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again. You won't have to start over." }, { status: 500 });
  }
}
