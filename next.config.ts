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
];

const nextConfig: NextConfig = {
  // Lets a production build sit beside a running dev server: NEXT_DIST_DIR=.next-prod next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Loaded by Node as they are, not bundled: PGlite (the local database) reads its own
  // WebAssembly files; the database driver and image tools are native or Node-only.
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "sharp", "web-push", "nodemailer"],
  async headers() {
    return [{ source: "/((?!media/).*)", headers: SECURITY_HEADERS }];
  }
};

export default nextConfig;
