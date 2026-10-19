/*
 * How Supabase's session cookies are set (lib/server/auth-provider.ts and middleware.ts).
 * Supabase's own default leaves them readable by the page's scripts, for sites that sign in
 * from the browser. Alumnity never does: only the server reads them. So they're HttpOnly
 * (a script that slipped onto a page still couldn't carry a member's session away), sent
 * only over HTTPS on the live site, and not sent along when another site posts to this one.
 */
export const SESSION_COOKIE = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production"
} as const;
