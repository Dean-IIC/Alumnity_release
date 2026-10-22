import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPUS_BLOCKS, HERO_PHOTO, WELCOME_COPY, findCampusBlock } from "../lib/campus";
import { BATCHES, ERAS, STUDENTS_SINCE_1998 } from "../lib/eras";
import { INTRO_PREFERENCE_SCRIPT } from "../lib/intro-preference";
import { blobOutline, blobRadius, COLOUR_SPREAD, makeInkBlobs, SKETCH_SPREAD, windowProgress } from "../lib/ink";
import { batchMarks, cameraAt, captionBox, FINALE, focusOn, framing, GHOST_OPACITY, INTRO_END, overview, penProgress, segmentTiming, stopTiming, STOPS, worldLayout, type WorldLayout } from "../lib/journey";
import { momentum, passing, settle } from "../lib/motion";

describe("campus blocks", () => {
  it("lists the campus photos the eras use", () => {
    expect(CAMPUS_BLOCKS.map((block) => block.id)).toEqual(["a-cse", "c"]);
    expect(findCampusBlock("c")?.label).toBe("C Block");
    expect(findCampusBlock("unknown")).toBeUndefined();
  });

  it("pairs every block with a local photo and its sketch", () => {
    for (const block of CAMPUS_BLOCKS) {
      expect(block.photo).toBe(`/assets/campus/journey/${block.id}.jpg`);
      expect(block.sketch).toBe(`/assets/campus/journey/${block.id}-sketch.jpg`);
      expect(block.inkOrigin.x).toBeGreaterThan(0);
      expect(block.inkOrigin.x).toBeLessThan(1);
    }
    // The hero is one campus photo, with a sketch for its ink bloom.
    expect(HERO_PHOTO.src).toBe("/assets/campus/hero/glass-block.jpg");
    expect(HERO_PHOTO.sketch).toBe("/assets/campus/hero/glass-block-sketch.jpg");
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

describe("the line as a timeline", () => {
  it("adds up to the register's total", () => {
    expect(Object.values(BATCHES).reduce((a, b) => a + b, 0)).toBe(8838);
    expect(STUDENTS_SINCE_1998).toBe(8838);
  });

  it("marks every full batch between the eras, in order, clear of the photos", () => {
    const marks = batchMarks();
    const eraYears = new Set(ERAS.map((era) => era.year));
    const expected = Object.keys(BATCHES).map(Number).filter((y) => y > 1998 && y <= 2022 && !eraYears.has(y));
    expect(marks.map((m) => m.year)).toEqual(expected);
    for (const mark of marks) {
      expect(mark.along).toBeGreaterThanOrEqual(0.24);
      expect(mark.along).toBeLessThanOrEqual(0.8);
      expect(ERAS[mark.segment - 1].year).toBeLessThan(mark.year);
      expect(ERAS[mark.segment].year).toBeGreaterThan(mark.year);
    }
  });
});

describe("journey timeline", () => {
  const wide = { width: 1440, height: 900 };
  const layout = worldLayout(wide);
  /** The pen's head, measured along straight lines between each stroke's ends. */
  const penAtFor = (route: WorldLayout) => (t: number) => {
    let i = route.segments.length - 1;
    while (i > 0 && t < segmentTiming(i)[0]) i -= 1;
    const [x0, y0] = route.segments[i].slice(1).split(/[ C]/).map(Number);
    const nums = route.segments[i].split(/[ MC]/).filter(Boolean).map(Number);
    const [x1, y1] = nums.slice(-2);
    const p = penProgress(i, t);
    return { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p };
  };
  const penAt = penAtFor(layout);

  it("lays out one shot per era and a line from the edge, through each, and out", () => {
    expect(layout.shots).toHaveLength(STOPS);
    expect(layout.segments).toHaveLength(STOPS + 1);
  });

  it("climbs on tall screens: each era sits higher than the one before", () => {
    const tall = worldLayout({ width: 390, height: 844 });
    const heights = tall.shots.map((shot) => shot.centre.y);
    expect(heights).toEqual([...heights].sort((a, b) => b - a));
  });

  it("never stops the pen: each stroke starts the moment the last one ends", () => {
    for (let i = 1; i <= STOPS; i += 1) {
      expect(segmentTiming(i)[0]).toBe(segmentTiming(i - 1)[1]);
      if (i < STOPS) expect(segmentTiming(i)[1]).toBe(stopTiming(i).arrive);
    }
  });

  it("slows the pen through each photo and hurries between them", () => {
    const speed = (u: number) => passing(u + 0.01) - passing(u);
    expect(speed(0.5)).toBeGreaterThan(speed(0) * 4);
    expect(speed(0)).toBeGreaterThan(0); // slow, not stopped
  });

  it("lets each photo be seen: it firms up as the pen nears, colours while framed", () => {
    expect(GHOST_OPACITY).toBeGreaterThanOrEqual(0.2);
    expect(GHOST_OPACITY).toBeLessThanOrEqual(0.3);
    for (let i = 0; i < STOPS; i += 1) {
      const timing = stopTiming(i);
      expect(timing.firm[0]).toBeLessThan(timing.arrive);
      expect(timing.framed[1] - timing.framed[0]).toBeGreaterThanOrEqual(1100);
      expect(timing.framed[1] - timing.ink[1]).toBeGreaterThanOrEqual(300); // seen, finished, before the camera moves
      // Framed for the whole time it colours: no arriving at a photo that's already done.
      for (let t = timing.ink[0] + 150; t <= timing.ink[1]; t += 50) expect(framing(t, i)).toBeCloseTo(1);
    }
  });

  it("routes the line around every caption, never through the text", () => {
    for (const viewport of [wide, { width: 390, height: 844 }]) {
      const route = worldLayout(viewport);
      const tall = viewport.width < viewport.height;
      const boxes = route.shots.map((shot) => captionBox(shot, tall));
      for (const d of route.segments) {
        const [x0, y0, x1, y1, x2, y2, x3, y3] = d.split(/[ MC]/).filter(Boolean).map(Number);
        for (let i = 0; i <= 200; i += 1) {
          const t = i / 200;
          const m = 1 - t;
          const x = m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3;
          const y = m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3;
          for (const box of boxes) {
            const inside = x > box.left && x < box.right && y > box.top && y < box.bottom;
            expect(inside, `${tall ? "tall" : "wide"} line at (${x.toFixed(0)}, ${y.toFixed(0)}) crosses a caption`).toBe(false);
          }
        }
      }
    }
  });

  it("brings the pen in from the side, at the photos' height, not across the bottom", () => {
    for (const viewport of [wide, { width: 390, height: 844 }]) {
      const route = worldLayout(viewport);
      const [start] = route.segments[0].slice(1).split(/[ C]/).map(Number);
      expect(start).toBeGreaterThan(route.width); // off the right-hand edge
    }
  });

  it("follows the pen between photos rather than jumping to the next", () => {
    for (let i = 1; i < STOPS; i += 1) {
      // Between letting go of one photo and easing into the next.
      const t = stopTiming(i - 1).framed[1] + 650;
      const camera = cameraAt(t, layout, wide, penAt);
      const pen = penAt(t - 220);
      expect(Math.hypot(camera.x - pen.x, camera.y - pen.y)).toBeLessThan(5);
    }
  });

  it("frames each photo while it colours", () => {
    for (let i = 0; i < STOPS; i += 1) {
      const t = stopTiming(i).ink[0] + 500;
      const camera = cameraAt(t, layout, wide, penAt);
      const focus = focusOn(layout.shots[i], wide);
      expect(camera.x).toBeCloseTo(focus.x);
      expect(camera.y).toBeCloseTo(focus.y);
    }
  });

  it("runs the finale in order and ends on the overview before shrinking", () => {
    const order = [FINALE.zoomOut, FINALE.shrink, FINALE.swoosh, FINALE.float, FINALE.reveal].map(([start]) => start);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(FINALE.zoomOut[0]).toBeGreaterThanOrEqual(stopTiming(STOPS - 1).ink[1]);
    expect(FINALE.shrink[0] - FINALE.zoomOut[1]).toBeGreaterThanOrEqual(1000);
    const all = overview(layout, wide);
    const atHold = cameraAt(FINALE.shrink[0], layout, wide, penAt);
    expect(atHold.scale).toBeCloseTo(all.scale);
    expect(INTRO_END).toBeGreaterThan(FINALE.reveal[1]);
  });
});

describe("motion with weight", () => {
  it("starts at rest and lands exactly", () => {
    for (const curve of [momentum, settle]) {
      expect(curve(0)).toBe(0);
      expect(curve(1)).toBe(1);
    }
  });

  it("moves the pen with momentum: quick to get going, then decelerating into place", () => {
    expect(momentum(0.25)).toBeGreaterThan(0.25);
    const late = momentum(0.95) - momentum(0.9);
    const early = momentum(0.15) - momentum(0.1);
    expect(late).toBeLessThan(early);
  });

  it("lets the camera overshoot a touch, then settle", () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => settle(i / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.03);
  });
});

describe("landing copy", () => {
  it("keeps the two welcome routes", () => {
    expect(WELCOME_COPY.primaryAction).toBe("Join now");
    expect(WELCOME_COPY.secondaryAction).toBe("Log in");
  });

  it("intro can be skipped, opted out of, and respects reduced motion", () => {
    const source = readFileSync(resolve(process.cwd(), "components/growing-campus-intro.tsx"), "utf8");
    expect(source).toContain("Skip intro <");
    expect(source).toContain("ink-intro__skip"); // the class the <head> script listens for
    expect(source).toContain("Don’t play the intro next time");
    expect(source).toContain("shouldPlayIntro()");
    // The pre-paint script honours both the stored opt-out and reduced motion, and ?intro=1 overrides.
    expect(INTRO_PREFERENCE_SCRIPT).toContain("prefers-reduced-motion: reduce");
    expect(INTRO_PREFERENCE_SCRIPT).toContain('localStorage.getItem("alumnity:intro")==="skip"');
    expect(INTRO_PREFERENCE_SCRIPT).toContain('get("intro")==="1"');
  });

  it("Skip intro works even when pressed before the page's scripts have loaded", () => {
    const listeners: ((event: unknown) => void)[] = [];
    const doc = {
      documentElement: { dataset: {} as Record<string, string> },
      addEventListener: (_type: string, fn: (event: unknown) => void) => listeners.push(fn)
    };
    // Run the <head> script as the browser would: the intro is set to play (?intro=1).
    new Function("document", "location", "matchMedia", "localStorage", "window", "performance", "sessionStorage", INTRO_PREFERENCE_SCRIPT)(
      doc,
      { search: "?intro=1", pathname: "/" },
      () => ({ matches: false }),
      { getItem: () => null },
      {},
      { getEntriesByType: () => [{ type: "navigate" }] },
      { getItem: () => null }
    );
    expect(doc.documentElement.dataset.intro).toBeUndefined();
    listeners[0]({ target: { closest: (selector: string) => (selector === ".ink-intro__skip" ? {} : null) } });
    expect(doc.documentElement.dataset.intro).toBe("skip");
  });

  it("plays on a first visit or a refresh of Home, not when coming back to it", () => {
    /** What the <head> script decides for one page load. */
    const run = (nav: string, playedInThisTab: boolean) => {
      const doc = { documentElement: { dataset: {} as Record<string, string> }, addEventListener: () => undefined };
      new Function("document", "location", "matchMedia", "localStorage", "window", "performance", "sessionStorage", INTRO_PREFERENCE_SCRIPT)(
        doc,
        { search: "", pathname: "/" },
        () => ({ matches: false }),
        { getItem: () => null },
        {},
        { getEntriesByType: () => [{ type: nav }] },
        { getItem: () => (playedInThisTab ? "1" : null) }
      );
      return doc.documentElement.dataset.intro === "skip" ? "skips" : "plays";
    };
    expect(run("navigate", false)).toBe("plays"); // first visit in this tab
    expect(run("reload", true)).toBe("plays"); // refresh on Home
    expect(run("back_forward", false)).toBe("skips"); // the Back button
    expect(run("navigate", true)).toBe("skips"); // opened again in the same tab
  });
});
