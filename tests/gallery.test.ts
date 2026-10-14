import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALBUMS, PHOTO_COUNT } from "../lib/gallery";

const publicFile = (src: string) => join(__dirname, "..", "public", src);

describe("gallery", () => {
  it("lists every album newest first, undated ones last", () => {
    const dates = ALBUMS.map((album) => album.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(ALBUMS.at(-1)?.date).toBe("");
  });

  it("keeps an event that happened more than once in one album, a part for each time", () => {
    const meets = ALBUMS.find((album) => album.slug === "alumni-meets");
    expect(meets?.parts.filter((part) => part.photos.length).map((part) => part.when)).toEqual(["2009", "2008"]);
    const drives = ALBUMS.find((album) => album.slug === "job-drives");
    expect(drives?.parts.map((part) => part.title)).toEqual(["Indian Air Force", "Indian Army"]);
    for (const album of ALBUMS) if (album.parts.length > 1) for (const part of album.parts) expect(part.title).toBeTruthy();
  });

  it("has a file for every photo and thumbnail, and the cover and its sketch", () => {
    for (const album of ALBUMS) {
      expect(existsSync(publicFile(album.cover.src))).toBe(true);
      expect(existsSync(publicFile(album.cover.sketch))).toBe(true);
      for (const photo of album.photos) {
        expect(existsSync(publicFile(photo.src))).toBe(true);
        expect(existsSync(publicFile(photo.thumb))).toBe(true);
      }
    }
  });

  it("describes every photo (an album's captions, if it has them, match its photos one for one)", () => {
    for (const album of ALBUMS) {
      expect(album.mosaic.length).toBe(Math.min(3, album.photos.length));
      for (const photo of album.photos) expect(photo.alt.length).toBeGreaterThan(10);
    }
    expect(new Set(ALBUMS.map((album) => album.slug)).size).toBe(ALBUMS.length);
    expect(PHOTO_COUNT).toBe(72);
    expect(ALBUMS).toHaveLength(11);
  });

  it("keeps out events that weren't the engineering college's own (checked on hkbk.edu.in)", () => {
    const slugs = ALBUMS.map((album) => album.slug).join(" ");
    expect(slugs).not.toMatch(/abhinandana|mega-job-fair|mega-pool/);
  });

  it("puts videos in albums: after a part's photos, or in a part of their own", () => {
    const around = ALBUMS.find((album) => album.slug === "around-campus-2024-25");
    const films = around?.parts.find((part) => part.title === "Films about the college");
    expect(films?.photos).toHaveLength(0);
    expect(films?.videos.map((v) => v.provider)).toEqual(["youtube", "youtube"]);
    // YouTube stills are saved with the site, so the page asks YouTube for nothing before play.
    for (const v of films?.videos ?? []) {
      expect(v.poster?.src).toMatch(/^\/assets\/gallery\//);
      expect(existsSync(publicFile(v.poster!.src))).toBe(true);
    }
    const stories = ALBUMS.find((album) => album.slug === "alumni-meets")?.parts.find((part) => part.title === "Alumni stories");
    expect(stories?.videos[0].provider).toBe("instagram");
  });
});
