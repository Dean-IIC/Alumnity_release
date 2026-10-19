import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/session-cookies";

/*
 * Keeps each member's Supabase session fresh: its access token lasts an hour, and pages
 * (server components) can't set cookies, so here, before every page, an expiring token is
 * swapped for a new one and the new cookies go back with the response.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || process.env.ALUMNITY_AUTH === "fake") return NextResponse.next();
  // Nobody signed in: nothing to refresh.
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    // HttpOnly and (live) HTTPS-only, as everywhere else they're set (lib/session-cookies.ts).
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      }
    }
  });
  // Checks the token, refreshing it if it's about to run out.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Pages and API calls; not the site's own files (scripts, styles, images, videos, fonts).
  matcher: ["/((?!_next/static|_next/image|assets/|favicon|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|mp4|webm|woff2?|css|js)$).*)"]
};
