import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "alumnity-media-"));
process.env.ALUMNITY_DB = join(dir, "test.db");
process.env.ALUMNITY_UPLOADS = join(dir, "uploads");

const { sniff, withoutExif, saveUpload, mediaById, readMedia } = await import("../lib/server/media");
const { database } = await import("../lib/server/db");

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...new TextEncoder().encode(p)] : p)));

describe("uploads", () => {
  it("knows a file by its first bytes, not its name", () => {
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniff(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(sniff(bytes([0, 0, 0, 0x20], "ftypisom"))?.kind).toBe("video");
    expect(sniff(bytes("\n  <!DOCTYPE html><html></html>"))?.kind).toBe("html");
    expect(sniff(bytes("MZ\u0090\u0000 not a picture"))).toBeNull(); // a Windows program, whatever it's called
    expect(sniff(bytes("%PDF-1.7"))).toBeNull();
  });

  it("takes the EXIF block (and the GPS position in it) out of a JPEG, and nothing else", () => {
    const exif = [0xff, 0xe1, 0x00, 0x0b, ...bytes("Exif\0\0GPS")]; // APP1: 2 length bytes + 9 of data
    const jfif = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]; // APP0, 4 bytes long
    const scan = [0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9];
    const out = withoutExif(bytes([0xff, 0xd8], exif, jfif, scan));
    expect([...out]).toEqual([0xff, 0xd8, ...jfif, ...scan]);
    expect(new TextDecoder().decode(out)).not.toContain("GPS");
  });

  it("keeps a member's upload, but a photo must be an image", () => {
    database().prepare("insert into users (id, email, password_hash, name, role, created_at) values (1, 'a@example.com', 'x', 'A B', 'alumnus', 0)").run();
    const html = bytes("<!doctype html><body><script>fetch('https://evil.example')</script></body>");
    expect(saveUpload(1, "photo", html)).toMatchObject({ ok: false });
    const saved = saveUpload(1, "cover", html);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(mediaById(saved.media.id)).toMatchObject({ userId: 1, kind: "html", mime: "text/html" });
    expect(readMedia(saved.media).length).toBe(html.length);
  });

  it("turns away files that are too big", () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    big.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(saveUpload(1, "photo", big)).toMatchObject({ ok: false, error: expect.stringMatching(/too big/) });
  });
});
