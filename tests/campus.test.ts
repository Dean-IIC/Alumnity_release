import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPUS_BLOCKS, FINAL_BLOCK_ID, HERO_IMAGE, WELCOME_COPY, findCampusBlock } from "../lib/campus";
import { ERAS, STUDENTS_SINCE_1998 } from "../lib/eras";
import { blobOutline, blobRadius, COLOUR_SPREAD, makeInkBlobs, SKETCH_SPREAD, windowProgress } from "../lib/ink";
import { cameraAt, FINALE, focusOn, INTRO_END, overview, segmentTiming, stopTiming, STOPS, worldLayout } from "../lib/journey";

describe("campus blocks", () => {
  it("follows the physical route A/CSE → Admin → B → C → D", () => {
    expect(CAMPUS_BLOCKS.map((block) => block.id)).toEqual(["a-cse", "admin", "b", "c", "d"]);
    expect(FINAL_BLOCK_ID).toBe("d");
    expect(findCampusBlock("d")?.label).toBe("D block");
    expect(findCampusBlock("unknown")).toBeUndefined();
  });

  it("pairs every block with a local photo and its sketch", () => {
    for (const block of CAMPUS_BLOCKS) {
      expect(block.photo).toBe(`/assets/campus/journey/${block.id}.jpg`);
      expect(block.sketch).toBe(`/assets/campus/journey/${block.id}-sketch.jpg`);
      expect(block.inkOrigin.x).toBeGreaterThan(0);
      expect(block.inkOrigin.x).toBeLessThan(1);
    }
    expect(HERO_IMAGE.startsWith("/assets/campus/")).toBe(true);
  });
});

describe("ink reveal", () => {
  const size = 350;
  const centre = { x: 0.5, y: 0.5 };
  const blobs = makeInkBlobs(size, centre, 11, COLOUR_SPREAD);

  it("is deterministic for a seed", () => {
    expect(makeInkBlobs(size, centre, 11, COLOUR_SPREAD)).toEqual(blobs);
  });

  it("lands at the centre and starts empty", () => {
    const main = blobs.find((blob) => blob.main)!;
    expect(main.x).toBe(size / 2);
    expect(main.y).toBe(size / 2);
    expect(blobs.every((blob) => blobRadius(blob, 0) === 0)).toBe(true);
  });

  it("ends as an irregular splotch that never reaches the frame's edges", () => {
    for (const spread of [COLOUR_SPREAD, SKETCH_SPREAD]) {
      for (const blob of makeInkBlobs(size, centre, 3, spread)) {
        for (const point of blobOutline(blob, 1, 180)) {
          expect(point.x).toBeGreaterThan(0);
          expect(point.x).toBeLessThan(size);
          expect(point.y).toBeGreaterThan(0);
          expect(point.y).toBeLessThan(size);
        }
      }
    }
    const reach = blobOutline(blobs[0], 1, 180).map((p) => Math.hypot(p.x - size / 2, p.y - size / 2));
    expect(Math.max(...reach) / Math.min(...reach)).toBeGreaterThan(1.15);
  });

  it("clamps window progress", () => {
    expect(windowProgress(50, 100, 200)).toBe(0);
    expect(windowProgress(150, 100, 200)).toBe(0.5);
    expect(windowProgress(250, 100, 200)).toBe(1);
  });
});

describe("eras", () => {
  it("run oldest first, each with its own photo and sketch", () => {
    const years = ERAS.map((era) => era.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(years[0]).toBe(1998);
    expect(ERAS[0].title).not.toMatch(/first batch/i); // founded 1997; the register starts in 1998
    for (const era of ERAS) {
      expect(era.photo.sketch).toBe(era.photo.photo.replace(/\.jpg$/, "-sketch.jpg"));
      expect(era.photo.source.length).toBeGreaterThan(0);
    }
    expect(new Set(ERAS.map((era) => era.photo.id)).size).toBe(ERAS.length);
    expect(STUDENTS_SINCE_1998).toBe(8838);
  });
});

describe("journey timeline", () => {
  const wide = { width: 1440, height: 900 };
  const layout = worldLayout(wide);

  it("lays out one shot per era and a line from the edge, through each, and out", () => {
    expect(layout.shots).toHaveLength(STOPS);
    expect(layout.segments).toHaveLength(STOPS + 1);
  });

  it("keeps the pen moving: it leaves each era just after landing there", () => {
    for (let i = 1; i <= STOPS; i += 1) {
      const [start, end] = segmentTiming(i);
      expect(start).toBe(stopTiming(i - 1).arrive + 100);
      expect(end).toBe(stopTiming(i).arrive);
    }
  });

  it("shows one transformation at a time: each bloom ends before the camera leaves", () => {
    for (let i = 0; i < STOPS - 1; i += 1) {
      const bloomEnd = stopTiming(i).ink[1];
      const held = cameraAt(bloomEnd, layout, wide);
      const focus = focusOn(layout.shots[i], wide);
      expect(held.x).toBeCloseTo(focus.x);
      expect(held.y).toBeCloseTo(focus.y);
    }
  });

  it("runs the finale in order and ends on the overview before shrinking", () => {
    const order = [FINALE.zoomOut, FINALE.shrink, FINALE.swoosh, FINALE.float, FINALE.reveal].map(([start]) => start);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(FINALE.zoomOut[0]).toBeGreaterThanOrEqual(stopTiming(STOPS - 1).ink[1]);
    expect(FINALE.shrink[0] - FINALE.zoomOut[1]).toBeGreaterThanOrEqual(1000);
    const all = overview(layout, wide);
    const atHold = cameraAt(FINALE.shrink[0], layout, wide);
    expect(atHold.scale).toBeCloseTo(all.scale);
    expect(INTRO_END).toBeGreaterThan(FINALE.reveal[1]);
  });
});

describe("landing copy", () => {
  it("keeps the two welcome routes", () => {
    expect(WELCOME_COPY.primaryAction).toBe("Find your place");
    expect(WELCOME_COPY.secondaryAction).toBe("I’m already here");
  });

  it("intro can be skipped and respects reduced motion", () => {
    const source = readFileSync(resolve(process.cwd(), "components/growing-campus-intro.tsx"), "utf8");
    expect(source).toContain(">Skip intro <");
    expect(source).toContain("prefers-reduced-motion: reduce");
  });
});
