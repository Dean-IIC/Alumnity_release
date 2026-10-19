import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * The four kinds of data kept apart: the college's register in `records`, its showcase
 * (gallery, pages, notices) in `site`, members' things in `public`, and the site's own
 * files in the repo. The migrations that moved the register and the notices are safe to run
 * again and again (PGlite runs every one on every start) and never lose a row.
 */

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_UPLOADS = mkdtempSync(join(tmpdir(), "alumnity-showcase-uploads-"));
process.env.ALUMNITY_SITE_FILES = mkdtempSync(join(tmpdir(), "alumnity-showcase-site-"));

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let register: typeof import("../lib/server/register");
let showcase: typeof import("../lib/server/showcase");
let pages: typeof import("../lib/server/site-pages");
let announcements: typeof import("../lib/server/announcements");

let n = 0;
async function member(role = "alumnus", usn: string | null = null): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, usn, branch, joined, role, created_at) values (?, ?, ?, 'CSE', 2012, ?, ?) returning id",
    `show${n}@example.com`,
    `Person ${n}`,
    usn,
    role,
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

async function jpeg(width: number, height: number): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  return new Uint8Array(await sharp({ create: { width, height, channels: 3, background: "#2a5db0" } }).jpeg().toBuffer());
}

const auditOf = async (subject: string) => (await db.db().all<{ action: string }>("select action from audit where subject = ? order by id", subject)).map((r) => r.action);

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  register = await import("../lib/server/register");
  showcase = await import("../lib/server/showcase");
  pages = await import("../lib/server/site-pages");
  announcements = await import("../lib/server/announcements");
});

describe("the migrations, run again and again (as PGlite does on every start)", () => {
  async function fresh() {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite();
    await db.runMigrations(pg);
    return pg;
  }
  const count = async (pg: { query<T>(sql: string): Promise<{ rows: T[] }> }, table: string) =>
    Number((await pg.query<{ n: number }>(`select count(*) as n from ${table}`)).rows[0].n);
  const exists = async (pg: { query<T>(sql: string): Promise<{ rows: T[] }> }, table: string) =>
    (await pg.query<{ t: string | null }>(`select to_regclass('${table}')::text as t`)).rows[0].t !== null;

  it("move the register to records and the notices to site, keep their rows, and leave no copy behind", async () => {
    const pg = await fresh();
    expect(await exists(pg, "records.register")).toBe(true);
    expect(await exists(pg, "public.register")).toBe(false);
    expect(await exists(pg, "site.announcements")).toBe(true);
    expect(await exists(pg, "public.announcements")).toBe(false);
    await pg.query("insert into records.register (name, usn, branch, branch_name, programme, year) values ('ASHA RAO', '1HK12CS001', 'CSE', 'CSE', 'B.Tech', 2012)");
    await pg.query("insert into site.announcements (title, body, created_at) values ('Alumni Day', '14 Dec', 1)");

    await db.runMigrations(pg);
    await db.runMigrations(pg);

    expect(await count(pg, "records.register")).toBe(1);
    expect(await count(pg, "site.announcements")).toBe(1);
    // The empty copies the first migration makes again are gone again.
    expect(await exists(pg, "public.register")).toBe(false);
    expect(await exists(pg, "public.announcements")).toBe(false);
    // Its id counter came along: the next line gets the next id.
    await pg.query("insert into records.register (name, usn, branch, branch_name, programme, year) values ('PRIYA NAIR', '1HK12CS003', 'CSE', 'CSE', 'B.Tech', 2012)");
    expect((await pg.query<{ id: number }>("select id from records.register order by id")).rows.map((r) => Number(r.id))).toEqual([1, 2]);
    await pg.close();
  });

  it("load the gallery and the pages once: a re-run adds nothing, and an album the desk deleted stays deleted", async () => {
    const pg = await fresh();
    expect(await count(pg, "site.albums")).toBe(11);
    expect(await count(pg, "site.photos")).toBe(72);
    expect(await count(pg, "site.videos")).toBe(3);
    expect(await count(pg, "site.pages")).toBe(6);
    await pg.query("delete from site.albums where slug = 'uninor-cup'");
    await db.runMigrations(pg);
    expect(await count(pg, "site.albums")).toBe(10);
    expect(await count(pg, "site.pages")).toBe(6);
    await pg.close();
  });

  it("stop, changing nothing, rather than drop a public.register that has rows", async () => {
    const pg = await fresh();
    await pg.query("insert into records.register (name, usn, branch, branch_name, programme, year) values ('ASHA RAO', '1HK12CS001', 'CSE', 'CSE', 'B.Tech', 2012)");
    await pg.query("create table public.register (like records.register including all)");
    await pg.query("insert into public.register (name, usn, branch, branch_name, programme, year) values ('LOST ROW', '1HK12CS099', 'CSE', 'CSE', 'B.Tech', 2012)");
    await expect(db.runMigrations(pg)).rejects.toThrow(/public\.register has rows/);
    expect(await count(pg, "public.register")).toBe(1);
    expect(await count(pg, "records.register")).toBe(1);
    await pg.close();
  });
});

describe("the register, in records", () => {
  beforeAll(async () => {
    const lines = [
      ["ASHA RAO", "1HK12CS001", "CSE", "Computer Science", "B.Tech", 2012],
      ["PRIYA NAIR", "1HK12CS003", "CSE", "Computer Science", "B.Tech", 2012],
      ["IMRAN KHAN", "1HK14EC010", "ECE", "Electronics", "B.Tech", 2014],
      ["MBA STUDENT", "1HK12MBA01", "GEN", "Management", "MBA", 2012]
    ] as const;
    for (const l of lines) await db.db().run("insert into records.register (name, usn, branch, branch_name, programme, year) values (?, ?, ?, ?, ?, ?)", ...l);
  });

  it("counts, finds and searches it, MBA left out", async () => {
    const facts = await register.registerFacts();
    expect(facts?.count).toBe(3);
    expect(facts?.branches.map((b) => b.code).sort()).toEqual(["CSE", "ECE"]);
    expect(await register.batchCount("CSE", 2012)).toBe(2);
    expect(await register.batchCount("GEN", 2012, "MBA")).toBe(0);
    expect((await register.registerByYear()).map((y) => [y.year, y.n])).toEqual([
      [2012, 2],
      [2014, 1]
    ]);

    // Joining: by USN and name, or by name, branch and year. Never an MBA line.
    expect((await register.findInRegister({ name: "Asha Rao", usn: "1hk12cs001" }))?.status).toBe("found");
    expect((await register.findInRegister({ name: "Priya Nair", branch: "CSE", year: 2012 }))?.status).toBe("found");
    expect((await register.findInRegister({ name: "Mba Student", usn: "1HK12MBA01" }))?.status).not.toBe("found");

    const me = await member();
    const found = await register.searchRegister(me, { q: "priya" });
    expect(found.people.map((p) => p.name)).toEqual(["Priya Nair"]);
    expect(JSON.stringify(found)).not.toMatch(/1HK/);
    expect((await register.searchRegister(me, { q: "mba" })).people).toEqual([]);
    expect((await register.browseRegister(me, {})).total).toBe(3);
  });
});

describe("notices, in site", () => {
  it("still go up, show and come down", async () => {
    const desk = await member("coordinator");
    const made = await announcements.createAnnouncement(desk, { title: "Alumni Day", body: "14 December", days: 3 });
    expect(made.ok).toBe(true);
    expect((await announcements.activeAnnouncements()).map((a) => a.title)).toContain("Alumni Day");
    expect((await announcements.allAnnouncements(desk))[0].author).toBe(desk.name);
    await announcements.removeAnnouncement(desk, made.id!);
    expect((await announcements.activeAnnouncements()).map((a) => a.title)).not.toContain("Alumni Day");
  });
});

describe("the showcase, kept by the college desk", () => {
  it("only the desk may change it", async () => {
    const student = await member("student");
    const faculty = await member("faculty");
    const [album] = await showcase.deskAlbums(await member("coordinator"));
    const photo = await db.db().one<{ id: number }>("select id from site.photos where album_id = (select id from site.albums where slug = ?) order by sort limit 1", album.slug);
    for (const who of [student, faculty]) {
      expect(await showcase.deskAlbums(who)).toEqual([]);
      expect(await showcase.deskAlbum(who, album.id)).toBeNull();
      expect((await showcase.createAlbum(who, { title: "Mine", date: "", when: "", about: "", published: true })).ok).toBe(false);
      expect((await showcase.updateAlbum(who, album.id, { title: "Changed", date: "", when: "", about: "", published: true })).ok).toBe(false);
      expect((await showcase.updatePhoto(who, photo!.id, { alt: "Something else", caption: "" })).ok).toBe(false);
      expect((await showcase.movePhoto(who, photo!.id, 1)).ok).toBe(false);
      expect((await showcase.setCover(who, photo!.id)).ok).toBe(false);
      expect((await showcase.deletePhoto(who, photo!.id)).ok).toBe(false);
      expect((await showcase.deleteAlbum(who, album.id)).ok).toBe(false);
      expect((await showcase.addSitePhoto(who, album.id, await jpeg(800, 600))).ok).toBe(false);
      expect((await showcase.startSitePhoto(who, album.id, 1000)).ok).toBe(false);
      expect((await pages.savePage(who, "director-letter", { body: "Hello", signerName: "Me" })).ok).toBe(false);
    }
    expect(await db.db().one("select 1 from site.albums where title = 'Mine'")).toBeUndefined();
    expect((await showcase.galleryAlbums()).length).toBe(11);
  });

  it("an album shows on the gallery only once it's published and has a photo", async () => {
    const desk = await member("coordinator");
    const made = await showcase.createAlbum(desk, { title: "Alumni Meet", date: "2026-12-14", when: "", about: "Back on campus.", published: false });
    expect(made.ok).toBe(true);
    const slug = (await db.db().one<{ slug: string; when_text: string }>("select slug, when_text from site.albums where id = ?", made.id))!;
    expect(slug).toEqual({ slug: "alumni-meet-2026", when_text: "14 December 2026" });

    const added = await showcase.addSitePhoto(desk, made.id!, await jpeg(3000, 2000));
    expect(added.ok).toBe(true);
    showcase.forgetShowcase();
    expect((await showcase.galleryAlbums()).map((a) => a.slug)).not.toContain("alumni-meet-2026");

    expect((await showcase.updateAlbum(desk, made.id!, { title: "Alumni Meet", date: "2026-12-14", when: "", about: "Back on campus.", published: true })).ok).toBe(true);
    const shown = await showcase.galleryAlbum("alumni-meet-2026");
    expect(shown?.photos).toHaveLength(1);
    // Newest first: it leads the gallery.
    expect((await showcase.galleryAlbums())[0].slug).toBe("alumni-meet-2026");
    // Made at 1600 px and 640 px, in the showcase's own folder, never with members' uploads.
    const photo = shown!.photos[0];
    expect(photo.src).toMatch(/^\/site-files\/albums\/\d+\/[\w-]+\.jpg$/);
    expect([photo.width, photo.height, photo.thumbWidth]).toEqual([1600, 1067, 640]);
    expect(readdirSync(join(process.env.ALUMNITY_SITE_FILES!, "albums", String(made.id)))).toHaveLength(2);
    expect(existsSync(join(process.env.ALUMNITY_UPLOADS!, "albums"))).toBe(false);
    expect(shown!.cover.src).toBe(photo.src);

    // A seeded album, hidden, leaves the gallery.
    const meets = (await showcase.deskAlbums(desk)).find((a) => a.slug === "alumni-meets")!;
    await showcase.updateAlbum(desk, meets.id, { title: meets.title, date: meets.date, when: meets.when, about: meets.about, published: false });
    expect(await showcase.galleryAlbum("alumni-meets")).toBeUndefined();
    await showcase.updateAlbum(desk, meets.id, { title: meets.title, date: meets.date, when: meets.when, about: meets.about, published: true });
    expect(await showcase.galleryAlbum("alumni-meets")).toBeDefined();
    expect(await auditOf(`album ${made.id}`)).toEqual(["made an album", "changed an album"]);
  });

  it("adds photos in two steps, changes their words and order, picks the cover and deletes, all in the audit log", async () => {
    const desk = await member("coordinator");
    const { id } = await showcase.createAlbum(desk, { title: "Sports Day", date: "2026", when: "", about: "", published: true });
    // The browser's two steps: a place to send the bytes (with the members' uploads, to wait), then "take it in".
    const started = await showcase.startSitePhoto(desk, id!, 5000);
    if (!started.ok) throw new Error(started.error);
    const path = decodeURIComponent(started.url.split("path=")[1]);
    expect(showcase.isSitePendingPath(desk, path)).toBe(true);
    expect(showcase.isSitePendingPath(await member("student"), path)).toBe(false);
    const { storage } = await import("../lib/server/storage");
    await storage().write(path, await jpeg(1200, 800), "image/jpeg");
    const first = await showcase.finishSitePhoto(desk, id!, started.token);
    expect(first.ok).toBe(true);
    expect(await storage().read(path)).toBeNull(); // the waiting copy is gone
    const second = await showcase.addSitePhoto(desk, id!, await jpeg(900, 1200));
    // Not a photo: refused.
    expect((await showcase.addSitePhoto(desk, id!, new TextEncoder().encode("<html>hi</html>"))).ok).toBe(false);

    expect((await showcase.updatePhoto(desk, second.id!, { alt: "Runners at the start", caption: "The 100 metres" })).ok).toBe(true);
    expect((await showcase.movePhoto(desk, second.id!, -1)).ok).toBe(true);
    let album = (await showcase.deskAlbum(desk, id!))!;
    expect(album.list.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(album.list[0]).toMatchObject({ alt: "Runners at the start", caption: "The 100 metres", cover: true });

    expect((await showcase.setCover(desk, first.id!)).ok).toBe(true);
    album = (await showcase.deskAlbum(desk, id!))!;
    expect(album.list.find((p) => p.cover)?.id).toBe(first.id);
    expect((await showcase.galleryAlbum(album.slug))?.mosaic[0].alt).toBe("Sports Day, 2026");

    // Deleting the cover: the first photo leads again, and the files go.
    const files = () => readdirSync(join(process.env.ALUMNITY_SITE_FILES!, "albums", String(id)));
    expect(files()).toHaveLength(4);
    expect((await showcase.deletePhoto(desk, first.id!)).ok).toBe(true);
    expect(files()).toHaveLength(2);
    expect((await showcase.galleryAlbum(album.slug))?.mosaic[0].caption).toBe("The 100 metres");

    expect((await showcase.deleteAlbum(desk, id!)).ok).toBe(true);
    expect(files()).toHaveLength(0);
    expect(await showcase.galleryAlbum(album.slug)).toBeUndefined();
    expect(await auditOf(`photo ${second.id}`)).toEqual(["added a photo", "changed a photo's words", "moved a photo earlier"]);
    expect(await auditOf(`album ${id}`)).toEqual(["made an album", "chose an album's cover", "deleted an album"]);
  });

  it("deleting a seeded album's photo leaves the repo's file alone", async () => {
    const desk = await member("coordinator");
    const row = await db.db().one<{ id: number; src: string }>("select p.id, p.src from site.photos p join site.albums a on a.id = p.album_id where a.slug = 'sports-day' order by p.sort limit 1");
    expect((await showcase.deletePhoto(desk, row!.id)).ok).toBe(true);
    expect(existsSync(join(__dirname, "..", "public", row!.src))).toBe(true);
  });
});

describe("the college's pages, in site", () => {
  it("show the college's words, which the desk changes; the code's words if a row is missing", async () => {
    const { PAGE_DEFAULTS } = await import("../lib/site-pages");
    expect(await pages.sitePage("director-letter")).toEqual(PAGE_DEFAULTS["director-letter"]);
    const desk = await member("coordinator");
    expect((await pages.savePage(desk, "director-letter", { body: "Dear alumni,\n\nWelcome home!", signerName: "A New Director", signerRole: "Director" })).ok).toBe(true);
    expect(await pages.sitePage("director-letter")).toMatchObject({ body: "Dear alumni,\n\nWelcome home!", signerName: "A New Director" });
    expect((await pages.savePage(desk, "director-letter", { body: "Hello", signerName: "" })).ok).toBe(false);
    expect((await pages.savePage(desk, "no-such-page", { body: "Hello" })).ok).toBe(false);
    expect(await auditOf("page director-letter")).toEqual(["changed a page"]);

    await db.db().run("delete from site.pages where slug = 'about-intro'");
    expect((await pages.sitePage("about-intro")).body).toBe(PAGE_DEFAULTS["about-intro"].body);
    const listed = await pages.deskPages(desk);
    expect(listed.map((p) => p.slug)).toEqual(["director-letter", "about-intro", "community-intro", "community-lead", "committee-office-bearers", "committee-members"]);
    expect(listed.find((p) => p.slug === "director-letter")?.editedBy).toBe(desk.name);
  });

  it("read a committee list line by line", async () => {
    const { rosterOf, paragraphsOf } = await import("../lib/site-pages");
    expect(rosterOf("President: Asha Rao\nTreasurer:\nSecretary")).toEqual([
      { role: "President", name: "Asha Rao" },
      { role: "Treasurer", name: "To be announced" },
      { role: "Secretary", name: "To be announced" }
    ]);
    expect(paragraphsOf("One\nline\n\n\nTwo")).toEqual(["One line", "Two"]);
  });
});
