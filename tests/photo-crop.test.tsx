import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * Framing a photo or a cover: three numbers kept beside the upload (lib/photo-crop.ts),
 * held to their ranges on the server, saved and read back with the page, travelling to
 * every face in a list inside its photo key, and cut in code for the alumni card's PNG.
 * A photo nobody has framed shows exactly as it always did.
 */

const dir = mkdtempSync(join(tmpdir(), "alumnity-crop-"));
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_UPLOADS = join(dir, "uploads");

const { cleanCrop, cropStyle, campusStyle, photoKey, readPhotoKey, squareCut, NO_CROP } = await import("../lib/photo-crop");
const { Avatar } = await import("../components/social/avatar");
const { db } = await import("../lib/server/db");
const { saveUpload } = await import("../lib/server/media");
const profile = await import("../lib/server/profile");
const { cardPhoto } = await import("../lib/server/alumni-card");
const sharp = (await import("sharp")).default;

let owner = 0;
let other = 0;
let photo = "";
let html = "";

/** A 400 × 200 picture: red on the left half, blue on the right. */
const halves = () =>
  sharp({ create: { width: 400, height: 200, channels: 3, background: "#ff0000" } })
    .composite([{ input: { create: { width: 200, height: 200, channels: 3, background: "#0000ff" } }, left: 200, top: 0 }])
    .png()
    .toBuffer();

beforeAll(async () => {
  owner = (await db().one<{ id: number }>("insert into users (email, name, role, created_at) values ('framer@example.com', 'Frame Owner', 'alumnus', 0) returning id"))!.id;
  other = (await db().one<{ id: number }>("insert into users (email, name, role, created_at) values ('nosy@example.com', 'Nosy Parker', 'alumnus', 0) returning id"))!.id;
  const saved = await saveUpload(owner, "photo", new Uint8Array(await halves()));
  if (!saved.ok) throw new Error(saved.error);
  photo = saved.media.id;
  const page = await saveUpload(owner, "cover", new TextEncoder().encode("<!doctype html><p>Hello</p>"));
  if (!page.ok) throw new Error(page.error);
  html = page.media.id;
});

describe("a framing's numbers", () => {
  it("are held to their ranges and rounded, whatever is sent", () => {
    expect(cleanCrop({ x: -3, y: 9, zoom: 50 })).toEqual({ x: 0, y: 1, zoom: 4 });
    expect(cleanCrop({ x: 0.123456, y: "0.25", zoom: 0.2 })).toEqual({ x: 0.123, y: 0.25, zoom: 1 });
    expect(cleanCrop({ x: Number.NaN, y: Infinity, zoom: 2 })).toEqual({ x: 0.5, y: 0.5, zoom: 2 });
    expect(cleanCrop({ x: "left", y: null, zoom: {} })).toBeUndefined(); // nothing usable: as it comes
    expect(cleanCrop("0.2,0.3,2")).toBeUndefined();
    expect(cleanCrop(null)).toBeUndefined();
    // One that changes nothing isn't kept.
    expect(cleanCrop({ x: 0.5, y: 0.5, zoom: 1 })).toBeUndefined();
  });

  it("travel inside a photo key, and come back the same (clamped if tampered with)", () => {
    const crop = { x: 0.2, y: 0.75, zoom: 1.5 };
    expect(photoKey("abc_-123", crop)).toBe("abc_-123~0.2,0.75,1.5");
    expect(readPhotoKey(photoKey("abc_-123", crop))).toEqual({ id: "abc_-123", crop });
    expect(readPhotoKey("abc~7,-1,99")).toEqual({ id: "abc", crop: { x: 1, y: 0, zoom: 4 } });
    expect(readPhotoKey("abc~nonsense")).toEqual({ id: "abc", crop: undefined });
  });

  it("cut the square the frame shows, inside the picture", () => {
    expect(squareCut(400, 200, undefined)).toEqual({ left: 100, top: 0, width: 200, height: 200 });
    expect(squareCut(400, 200, { x: 0, y: 0.5, zoom: 1 })).toEqual({ left: 0, top: 0, width: 200, height: 200 });
    expect(squareCut(400, 200, { x: 1, y: 1, zoom: 2 })).toEqual({ left: 300, top: 100, width: 100, height: 100 });
  });
});

describe("a photo nobody has framed", () => {
  it("shows exactly as before: the middle, just covering its frame, the same markup", () => {
    expect(NO_CROP).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    expect(readPhotoKey("abc")).toEqual({ id: "abc" });
    expect(photoKey("abc", undefined)).toBe("abc");
    expect(photoKey("abc", NO_CROP)).toBe("abc");
    expect(cropStyle(undefined)).toBeUndefined();
    expect(cropStyle(NO_CROP)).toBeUndefined();
    expect(campusStyle(null)).toBeUndefined();
    expect(renderToStaticMarkup(<Avatar name="Asha Rao" photoId="abc" size={44} />)).toBe(
      '<img class="avatar " src="/media/abc?v=3&amp;w=44" alt="" width="44" height="44" loading="lazy" decoding="async"/>'
    );
  });

  it("framed, sits in a round window, moved and grown", () => {
    const html = renderToStaticMarkup(<Avatar name="Asha Rao" photoId="abc~0.2,0.3,2" size={44} />);
    expect(html).toContain('class="avatar avatar--framed "');
    expect(html).toContain("object-position:20% 30%");
    expect(html).toContain("transform:scale(2)");
    expect(html).toContain('src="/media/abc?v=3&amp;w=88"'); // the framing is never part of the file's address
  });
});

describe("saving a framing with the page", () => {
  it("keeps the photo's and the campus drawing's framing, clamped, and reads them back", async () => {
    const parsed = await profile.parseProfile({ photo: { id: photo, kind: "image", crop: { x: 0, y: 2, zoom: 9 } }, campusCrop: { x: 0.9, y: 0.1, zoom: 1.4 } }, owner);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.profile.photo).toEqual({ id: photo, kind: "image", crop: { x: 0, y: 1, zoom: 4 } });
    expect(parsed.profile.campusCrop).toEqual({ x: 0.9, y: 0.1, zoom: 1.4 });
    await profile.saveProfile(owner, parsed.profile);

    const back = await profile.profileOf(owner);
    expect(back.photo?.crop).toEqual({ x: 0, y: 1, zoom: 4 });
    expect(back.campusCrop).toEqual({ x: 0.9, y: 0.1, zoom: 1.4 });
    // Everyone who sees the page sees it framed the same way.
    expect(profile.profileFor({ id: other, branch: null, joined: null }, { id: owner, branch: null, joined: null }, back).photo?.crop).toEqual({ x: 0, y: 1, zoom: 4 });
    // And every face in a list, from the one query that was always made.
    expect((await profile.photoIdsOf([owner])).get(owner)).toBe(`${photo}~0,1,4`);
  });

  it("drops a framing that changes nothing, and has none to keep for an HTML cover", async () => {
    const parsed = await profile.parseProfile({ photo: { id: photo, crop: { x: 0.5, y: 0.5, zoom: 1 } }, cover: { id: html, crop: { x: 0, y: 0, zoom: 3 } } }, owner);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.profile.photo).toEqual({ id: photo, kind: "image" });
    expect(parsed.profile.cover).toEqual({ id: html, kind: "html" });
    expect(parsed.profile.campusCrop).toBeNull();
    await profile.saveProfile(owner, parsed.profile);
    expect((await profile.photoIdsOf([owner])).get(owner)).toBe(photo); // unframed: the plain id, as before
  });

  it("a page saved before framing came reads as unframed", async () => {
    await db().run("update profiles set data = ? where user_id = ?", JSON.stringify({ photo: { id: photo, kind: "image" }, title: "Old page" }), owner);
    const old = await profile.profileOf(owner);
    expect(old.photo).toEqual({ id: photo, kind: "image" });
    expect(old.campusCrop).toBeNull();
    expect((await profile.photoIdsOf([owner])).get(owner)).toBe(photo);
  });

  it("won't let anyone else frame (or take) a member's photo", async () => {
    await profile.saveProfile(owner, { ...(await profile.profileOf(owner)), photo: { id: photo, kind: "image", crop: { x: 0.25, y: 0.5, zoom: 2 } } });
    // Their own page is the only one anybody saves (the route takes who from the session);
    // naming someone else's upload on it is refused, framing and all.
    expect(await profile.parseProfile({ photo: { id: photo, kind: "image", crop: { x: 1, y: 1, zoom: 4 } } }, other)).toHaveProperty("error");
    expect((await profile.profileOf(owner)).photo?.crop).toEqual({ x: 0.25, y: 0.5, zoom: 2 });
    // Nor does the card's photo come out for anyone but its owner.
    expect(await cardPhoto(`${photo}~1,1,4`, other)).toBeNull();
  });
});

describe("the alumni card's PNG", () => {
  /** The colour in the middle of a card photo (a JPEG data URL). */
  const middle = async (url: string | null) => {
    if (!url) throw new Error("No photo");
    const { data } = await sharp(Buffer.from(url.split(",")[1], "base64")).resize(1, 1, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });
    return data[0] > data[2] ? "red" : "blue";
  };

  it("cuts the square the member framed (the middle when they haven't)", async () => {
    expect(await middle(await cardPhoto(`${photo}~0,0.5,1`, owner))).toBe("red");
    expect(await middle(await cardPhoto(`${photo}~1,0.5,1`, owner))).toBe("blue");
    // Unframed: the middle square, half red, half blue, as it always was.
    const plain = await cardPhoto(photo, owner);
    const { info } = await sharp(Buffer.from(plain!.split(",")[1], "base64")).toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([320, 320]);
  });
});
