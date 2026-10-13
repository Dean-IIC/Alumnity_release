import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPUS_BLOCKS, D_BLOCK_REAL_IMAGE, FINAL_BLOCK_ID, findCampusBlock, WELCOME_COPY } from "../lib/campus";

describe("campus blocks", () => {
  it("keeps the physical HKBK route from A/CSE to D", () => {
    expect(CAMPUS_BLOCKS.map((block) => block.id)).toEqual([
      "a-cse",
      "admin",
      "b",
      "c",
      "d"
    ]);
    expect(FINAL_BLOCK_ID).toBe("d");
    expect(CAMPUS_BLOCKS.every((block) => block.illustration.startsWith("/assets/campus/growing-intro/"))).toBe(true);
    expect(D_BLOCK_REAL_IMAGE).toBe("/assets/campus/growing-intro/d-block-real.jpg");
    expect(findCampusBlock("d")?.label).toBe("D block");
    expect(findCampusBlock("unknown")).toBeUndefined();
  });
});

describe("landing copy", () => {
  it("keeps the welcome purpose and two clear next actions", () => {
    expect(WELCOME_COPY.title).toBe("Stay connected to where it began.");
    expect(WELCOME_COPY.primaryAction).toBe("Find your place");
    expect(WELCOME_COPY.secondaryAction).toBe("I’m already here");
  });
});

describe("growing ink intro", () => {
  it("renders the five blocks in physical order and exposes a skip action", () => {
    const source = readFileSync(resolve(process.cwd(), "components/growing-campus-intro.tsx"), "utf8");

    expect(source).toContain('data-block={block.id}');
    expect(source).toContain(">Skip intro <");
    expect(source).toContain("prefers-reduced-motion: reduce");
  });
});
