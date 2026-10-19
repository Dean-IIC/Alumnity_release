import { defineConfig } from "vitest/config";

export default defineConfig({
  // JSX as Next compiles it (no React import needed), for server code that renders components.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // Each file starts its own Postgres (PGlite) on first use: a few seconds, longer when
    // files run side by side, so the first test in a file gets room for that.
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
