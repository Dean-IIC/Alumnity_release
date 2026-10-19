import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/*
 * Security: how the site is set up. Supabase's public API (its anon and authenticated keys,
 * which any browser can have) reaches no table; the uploads bucket is private; every page
 * carries headers that stop framing, sniffing and leaking; session cookies can't be read by
 * scripts; signing in without Supabase can never be switched on in production; the account
 * endpoints answer only this site; and no secret is ever meant for the browser.
 */

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";

const root = process.cwd();
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const env = process.env as Record<string, string | undefined>;

function sources(...dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(f)) out.push(p);
    }
  };
  for (const d of dirs) walk(join(root, d));
  return out;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase's public API reaches nothing", () => {
  let db: typeof import("../lib/server/db");
  beforeAll(async () => {
    db = await import("../lib/server/db");
    await db.db().one("select 1"); // every migration has run
  });

  it("every table, in every schema the migrations make, has row-level security on", async () => {
    const tables = await db.db().all<{ schema: string; name: string; rls: boolean }>(
      `select n.nspname as schema, c.relname as name, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast') and n.nspname not like 'pg_%'`
    );
    expect(tables.length).toBeGreaterThan(20);
    expect(tables.filter((t) => !t.rls).map((t) => `${t.schema}.${t.name}`)).toEqual([]);
  });

  it("with no policies at all, so the anon and authenticated keys can read and write nothing", async () => {
    expect(await db.db().all("select schemaname, tablename, policyname from pg_policies")).toEqual([]);
    // Nor do the migrations make any (a later one could; it must come with a reason and a test).
    for (const file of readdirSync(join(root, "supabase", "migrations"))) {
      expect(read("supabase", "migrations", file), file).not.toMatch(/create\s+policy/i);
      expect(read("supabase", "migrations", file), file).not.toMatch(/grant\s+[^;]*\bto\s+(anon|authenticated|public)\b/i);
    }
  });

  it("the uploads bucket is private", () => {
    const storage = read("supabase", "migrations", "20261015000002_storage.sql");
    expect(storage).toMatch(/values \('media', 'media', false/);
    expect(storage).toMatch(/do update set public = false/);
  });
});

describe("headers on every page", () => {
  it("in production: no framing by other sites, no sniffing, no eval, HTTPS only", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const config = (await import("../next.config")).default;
    const rules = await config.headers!();
    const page = rules.find((r) => r.source === "/((?!media/).*)")!;
    const h = Object.fromEntries(page.headers.map((x) => [x.key.toLowerCase(), x.value]));
    expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).toContain("base-uri 'self'");
    expect(h["content-security-policy"]).toContain("form-action 'self'");
    expect(h["content-security-policy"]).not.toContain("unsafe-eval");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["strict-transport-security"]).toMatch(/max-age=\d{8,}/);
    expect(config.poweredByHeader).toBe(false);
  });
});

describe("sessions", () => {
  it("Supabase's session cookies are HttpOnly and SameSite, and HTTPS-only in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { SESSION_COOKIE } = await import("../lib/session-cookies");
    expect(SESSION_COOKIE).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    // Both places that set them use these.
    expect(read("middleware.ts")).toMatch(/cookieOptions: SESSION_COOKIE/);
    expect(read("lib", "server", "auth-provider.ts")).toMatch(/cookieOptions: SESSION_COOKIE/);
  });

  it("signing in without Supabase is never on in production, and never on Vercel", async () => {
    const { localAuthAllowed } = await import("../lib/server/auth-provider");
    expect(localAuthAllowed({ ALUMNITY_AUTH: "local", NODE_ENV: "development" })).toBe(true);
    expect(localAuthAllowed({ ALUMNITY_AUTH: "local", NODE_ENV: "production" })).toBe(false);
    expect(localAuthAllowed({ ALUMNITY_AUTH: "local", NODE_ENV: "production", ALUMNITY_LOCAL_PROD: "1" })).toBe(true); // a build tried on this computer
    expect(localAuthAllowed({ ALUMNITY_AUTH: "local", NODE_ENV: "production", ALUMNITY_LOCAL_PROD: "1", VERCEL: "1" })).toBe(false);
    expect(localAuthAllowed({ ALUMNITY_AUTH: "local", NODE_ENV: "development", VERCEL: "1" })).toBe(false);
    expect(localAuthAllowed({ ALUMNITY_AUTH: "fake", NODE_ENV: "development" })).toBe(false);
    expect(localAuthAllowed({ NODE_ENV: "development" })).toBe(false);
    // And local-auth.ts refuses to start on its own too.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALUMNITY_AUTH", "local");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("ALUMNITY_LOCAL_PROD", "1");
    const { localAuth } = await import("../lib/server/local-auth");
    expect(() => localAuth()).toThrow(/development only/);
  });

  it("the test stand-in for Supabase is for the tests alone", () => {
    expect(read("lib", "server", "auth-provider.ts")).toMatch(/ALUMNITY_AUTH === "fake" && process\.env\.NODE_ENV === "test"/);
  });
});

describe("tools for working on this computer", () => {
  const headersFor = (list: Record<string, string>) => {
    vi.doMock("next/headers", () => ({ headers: async () => new Headers(list) }));
  };

  it("answer only on this computer: not in production, not through a tunnel or the network", async () => {
    const check = async (list: Record<string, string>, nodeEnv = "development") => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", nodeEnv);
      headersFor(list);
      return (await import("../lib/server/dev-only")).isLocalDev();
    };
    expect(await check({ host: "localhost:3000", "x-forwarded-for": "::1" })).toBe(true);
    expect(await check({ host: "localhost:3000" }, "production")).toBe(false);
    expect(await check({ host: "localhost:3000", "cf-connecting-ip": "203.0.113.9" })).toBe(false);
    expect(await check({ host: "alumnity.example" })).toBe(false);
    expect(await check({ host: "localhost:3000", "x-forwarded-for": "192.168.1.20" })).toBe(false); // "Host: localhost" from the network
    expect(await check({ host: "localhost:3000", "x-forwarded-host": "evil.example" })).toBe(false);
    vi.doUnmock("next/headers");
  });

  it("the design lab and the sample members are not part of the production site", () => {
    expect(read("app", "lab", "page.tsx")).toMatch(/if \(process\.env\.NODE_ENV === "production"\) notFound\(\)/);
    expect(read("app", "dev", "seed", "page.tsx")).toMatch(/if \(!\(await isLocalDev\(\)\)\) notFound\(\)/);
    const dev = read("lib", "actions", "dev.ts");
    expect(dev.match(/if \(!\(await isLocalDev\(\)\)\) return/g)).toHaveLength(2);
  });
});

describe("the account endpoints answer only this site", () => {
  it("an Origin of another site, of null, or none at all is refused; so is a body that isn't JSON", async () => {
    const { readJson } = await import("../lib/server/http");
    const call = (headers: Record<string, string>, body = "{}") => readJson(new Request("http://localhost/api/auth/login", { method: "POST", headers, body }));
    const status = async (headers: Record<string, string>, body?: string) => {
      const result = await call(headers, body);
      return result instanceof Response ? result.status : 200;
    };
    const json = { "content-type": "application/json", "x-forwarded-host": "localhost" };
    expect(await status({ ...json, origin: "https://evil.example" })).toBe(403);
    expect(await status({ ...json, origin: "null" })).toBe(403);
    expect(await status({ ...json, origin: "not a url" })).toBe(403);
    expect(await status({ ...json, origin: "http://localhost.evil.example" })).toBe(403);
    expect(await status(json)).toBe(403);
    expect(await status({ "content-type": "text/plain", "x-forwarded-host": "localhost", origin: "http://localhost" })).toBe(415);
    expect(await status({ ...json, origin: "http://localhost" }, "not json")).toBe(400);
    expect(await status({ ...json, origin: "http://localhost" })).toBe(200);
  });

  it("the daily job and the health check need the secret; the health check is off unless asked for", async () => {
    const { GET: cron } = await import("../app/api/cron/digest/route");
    const { GET: health } = await import("../app/api/health/route");
    vi.stubEnv("CRON_SECRET", "a-cron-secret");
    expect((await cron(new Request("http://localhost/api/cron/digest"))).status).toBe(401);
    expect((await cron(new Request("http://localhost/api/cron/digest", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await cron(new Request("http://localhost/api/cron/digest", { headers: { authorization: "Bearer " } }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await cron(new Request("http://localhost/api/cron/digest", { headers: { authorization: "Bearer " } }))).status).toBe(401);
    expect((await cron(new Request("http://localhost/api/cron/digest", { headers: { authorization: "Bearer undefined" } }))).status).toBe(401);
    vi.stubEnv("ALUMNITY_HEALTH", "");
    expect((await health(new Request("http://localhost/api/health"))).status).toBe(404);
  });

  it("the stop-emails link works only with its member's own signature", async () => {
    const digest = await import("../lib/server/digest");
    vi.stubEnv("ALUMNITY_SECRET", "a-site-secret");
    const token = digest.unsubscribeToken(5)!;
    expect(digest.checkUnsubscribe(5, token)).toBe(true);
    expect(digest.checkUnsubscribe(6, token)).toBe(false);
    expect(digest.checkUnsubscribe(5, "")).toBe(false);
    vi.stubEnv("ALUMNITY_SECRET", "");
    expect(digest.checkUnsubscribe(5, token)).toBe(false);
  });
});

describe("secrets", () => {
  it("only Supabase's address and public key are meant for the browser", () => {
    const named = new Set<string>();
    for (const file of sources("app", "components", "lib")) for (const m of readFileSync(file, "utf8").matchAll(/NEXT_PUBLIC_\w+/g)) named.add(m[0]);
    expect([...named].sort()).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  });

  it("no code that runs in the browser reads a server secret or imports the server's database or storage", () => {
    for (const file of sources("app", "components", "lib")) {
      const text = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(text)) continue;
      expect(text, file).not.toMatch(/process\.env\.(?!NODE_ENV)/);
      expect(text, file).not.toMatch(/from\s+["'][./]*(lib\/)?server\/(db|storage|auth|secrets|razorpay|local-auth|mail)["']/);
    }
  });

  it("no keys in the code, and .env files never committed", () => {
    for (const file of sources("app", "components", "lib", "scripts").concat([join(root, "middleware.ts"), join(root, "next.config.ts")])) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/rzp_live_[A-Za-z0-9]{6,}|eyJhbGciOi[A-Za-z0-9_-]{30,}|sk_live_|postgres(ql)?:\/\/[^\s"'`:]+:[^\s"'`@]{6,}@|BEGIN [A-Z ]*PRIVATE KEY/);
    }
    const ignore = read(".gitignore");
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^\.env\.\*$/m);
    expect(ignore).toMatch(/^data\/pglite\*$/m);
    expect(ignore).toMatch(/^data\/\*\.csv$/m);
  });
});
