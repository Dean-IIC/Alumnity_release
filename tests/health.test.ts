import { beforeAll, describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.CRON_SECRET = "test-health-secret";
process.env.ALUMNITY_HEALTH = "on";
delete process.env.NEXT_PUBLIC_SUPABASE_URL;

let db: typeof import("../lib/server/db");
let GET: typeof import("../app/api/health/route").GET;

beforeAll(async () => {
  db = await import("../lib/server/db");
  ({ GET } = await import("../app/api/health/route"));
  for (const [email, role] of [
    ["student.health@example.com", "student"],
    ["alumnus.health@example.com", "alumnus"],
    ["admin.health@example.com", "admin"]
  ])
    await db.db().run("insert into users (email, name, branch, joined, role, created_at) values (?, ?, 'CSE', 2020, ?, ?)", email, `Health ${role}`, role, Date.now());
});

const ask = (query = "", secret = "test-health-secret") =>
  GET(new Request(`http://localhost/api/health${query}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} }));

describe("the health check", () => {
  it("isn't there at all unless it's switched on", async () => {
    process.env.ALUMNITY_HEALTH = "";
    expect((await ask()).status).toBe(404);
    process.env.ALUMNITY_HEALTH = "on";
    expect((await ask()).status).toBe(200);
  });

  it("is only for whoever holds the secret", async () => {
    expect((await ask("", "")).status).toBe(401);
    expect((await ask("", "wrong-secret-of-same-size")).status).toBe(401);
    expect((await ask()).status).toBe(200);
  });

  it("times the database, and Home for each kind of member, without sending anyone's details", async () => {
    const plain = await (await ask()).json();
    expect(plain.database.roundTripsMs).toHaveLength(5);
    expect(plain.database.transactions).toMatchObject({ ok: true, oneTransaction: true, rolledBack: true });
    for (const email of ["student.health@example.com", "alumnus.health@example.com", "admin.health@example.com"]) {
      const body = await (await ask(`?as=${email}`)).json();
      expect(body.home.queries).toBeGreaterThan(5);
      expect(body.home.finished).toBe(true);
      expect(body.home.stillRunning).toEqual([]);
      // Every part of Home finished, each with its own time.
      expect(Object.keys(body.home.parts)).toEqual(expect.arrayContaining(["feedFor", "photoIdsOf (feed)", "peopleToMeet", "layout: unread messages"]));
      for (const value of Object.values(body.home.parts)) expect(typeof value).toBe("number");
      expect(JSON.stringify(body)).not.toContain("Health ");
      expect(JSON.stringify(body)).not.toContain("@example.com");
    }
    expect((await (await ask("?as=nobody@example.com")).json()).home).toBe("no member with that email");
  });

  it("notes each query a piece of work makes", async () => {
    const { result, queries } = await db.traced(async () => {
      await db.db().one("select 1");
      return Promise.all([db.db().one("select 2 as n"), db.db().one("select 3 as n")]);
    });
    expect(result).toHaveLength(2);
    expect(queries.map((q) => q.sql).sort()).toEqual(["select 1", "select 2 as n", "select 3 as n"]);
    expect(queries.every((q) => typeof q.ms === "number")).toBe(true);
  });
});
