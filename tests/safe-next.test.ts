import { describe, expect, it } from "vitest";
import { safeNext } from "../lib/safe-next";

describe("where to go after logging in", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/people/12")).toBe("/people/12");
    expect(safeNext("/people?q=asha#top")).toBe("/people?q=asha#top");
  });

  it("refuses anything that leaves the site", () => {
    const bad = ["//evil.example", String.raw`/\evil.example`, String.raw`/\/evil.example`, "https://evil.example", "javascript:alert(1)", "evil", "", null, undefined];
    for (const next of bad) expect(safeNext(next), String(next)).toBe("/home");
  });

  it("can't be tricked by tabs or newlines inside the slashes", () => {
    // Browsers drop tabs and newlines from URLs, so "/\t/evil.example" would become "//evil.example".
    expect(safeNext("/\t/evil.example")).toBe("/home");
    expect(safeNext("/\n/evil.example")).toBe("/home");
  });
});
