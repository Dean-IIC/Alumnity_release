import type { NextConfig } from "next";

/*
 * Headers on every page. No other site may frame Alumnity (so nobody can trick a member
 * into clicking inside a hidden copy of it), forms may only post back here, nothing is
 * sniffed as another type, and links don't leak which member page someone came from.
 * /media/* sets its own, stricter headers (uploads, including sandboxed HTML covers).
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }
];

const nextConfig: NextConfig = {
  // Lets a production build sit beside a running dev server: NEXT_DIST_DIR=.next-prod next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/((?!media/).*)", headers: SECURITY_HEADERS }];
  }
};

export default nextConfig;
