import type { NextConfig } from "next";

/*
 * Headers on every page. No other site may frame Alumnity (so nobody can trick a member
 * into clicking inside a hidden copy of it), forms may only post back here, nothing is
 * sniffed as another type, links don't leak which member page someone came from, and
 * scripts only come from here (or Razorpay's checkout).
 * /media/* sets its own, stricter headers (uploads, including sandboxed HTML covers).
 */
// Scripts only from Alumnity itself and Razorpay's checkout (and, on preview deployments,
// Vercel's toolbar). Inline scripts stay allowed: Next streams each page with small inline
// ones, and a nonce instead would make every page render per request.
const SCRIPTS = ["'self'", "'unsafe-inline'", "https://*.razorpay.com", "https://vercel.live"]
  // Development's hot reload evaluates code; production never does.
  .concat(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"])
  .join(" ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: `frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src ${SCRIPTS}` },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }
].concat(
  // The live site only ever over HTTPS: a browser that has been once never tries plain HTTP
  // again (where someone on the same Wi-Fi could read or change the page). Not on this
  // computer, which serves plain HTTP.
  process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []
);

const nextConfig: NextConfig = {
  // Lets a production build sit beside a running dev server: NEXT_DIST_DIR=.next-prod next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // No Next.js "N" button in the corner while developing: blind tests (a model that only
  // sees the screen) kept tapping it. It never shows on the live site either way.
  devIndicators: false,
  experimental: {
    // A page you were on a moment ago comes back at once (Back, or a tab you just left),
    // instead of asking the server again: on a phone, that wait was most of the lag. Up to
    // 30 seconds old; anything you do (post, reply, connect) refreshes it straight away
    // (the actions call revalidatePath).
    staleTimes: { dynamic: 30, static: 300 },
    // HQ's register import sends the whole register's CSV (about 700 KB) to a server action.
    serverActions: { bodySizeLimit: "3mb" }
  },
  // Loaded by Node as they are, not bundled: PGlite (the local database) reads its own
  // WebAssembly files; the database driver and image tools are native or Node-only.
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "sharp", "web-push", "nodemailer"],
  async headers() {
    return [{ source: "/((?!media/).*)", headers: SECURITY_HEADERS }];
  }
};

export default nextConfig;
