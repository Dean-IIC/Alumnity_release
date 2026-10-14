import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build sit beside a running dev server: NEXT_DIST_DIR=.next-prod next build
  distDir: process.env.NEXT_DIST_DIR || ".next"
};

export default nextConfig;
