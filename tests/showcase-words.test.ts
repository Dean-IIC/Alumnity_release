import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * 20261020000000_simpler_showcase_words.sql: a database seeded before the simpler words
 * gets them, but only where the college desk hasn't changed the text since.
 */
const UPDATE = readFileSync(join(process.cwd(), "supabase", "migrations", "20261020000000_simpler_showcase_words.sql"), "utf8");

async function migrated() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { runMigrations } = await import("../lib/server/db");
  const pg = new PGlite();
  await runMigrations(pg);
  return pg;
}

const pageBody = async (pg: Awaited<ReturnType<typeof migrated>>, slug: string) =>
  ((await pg.query<{ body: string }>("select body from site.pages where slug = $1", [slug])).rows[0] ?? { body: "" }).body;

describe("the simpler showcase words, for a database seeded before them", () => {
  it("replaces the old words with the new", async () => {
    const pg = await migrated();
    const now = await pageBody(pg, "community-intro");
    // As a database seeded before the change has it.
    await pg.query("update site.pages set body = $1 where slug = 'community-intro'", ["Who Alumnity is for, what is open to everyone, and what members get."]);
    await pg.query("update site.albums set about = $1 where slug = 'job-drives'", ["The days the Indian Army and the Indian Air Force came to the college to hire students."]);
    await pg.exec(UPDATE);
    expect(await pageBody(pg, "community-intro")).toBe(now);
    expect((await pg.query<{ about: string }>("select about from site.albums where slug = 'job-drives'")).rows[0].about).toBe("The Indian Army and the Indian Air Force came to the college to hire students.");
  });

  it("leaves words the college desk has changed", async () => {
    const pg = await migrated();
    await pg.query("update site.pages set body = 'Words the desk wrote.' where slug = 'community-intro'");
    await pg.exec(UPDATE);
    await pg.exec(UPDATE);
    expect(await pageBody(pg, "community-intro")).toBe("Words the desk wrote.");
  });
});
