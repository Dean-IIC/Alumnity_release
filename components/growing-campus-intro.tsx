"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ERAS, STUDENTS_SINCE_1998 } from "../lib/eras";
import { blobOutline, COLOUR_SPREAD, easeInOutCubic, easeOutCubic, makeInkBlobs, outlineToPath, windowProgress } from "../lib/ink";
import { readIntroPreference, shouldPlayIntro, writeIntroPreference } from "../lib/intro-preference";
import { BACKDROP_PARALLAX, backdropYears, batchDotRadius, batchMarks, cameraAt, inkSplats, FINALE, GHOST_OPACITY, INTRO_END, penProgress, segmentTiming, stopTiming, worldLayout, type WorldLayout } from "../lib/journey";
import { LOGO } from "./brand-lockup";
import { InkPhoto } from "./ink-photo";

/*
 * The intro, on one timeline:
 *   1. Eras. One continuous red ink line runs under each era's photo; where it lands a
 *      blot drops, the pencil sketch develops and an ink splotch soaks the colour in.
 *      The pen never stops — it heads for the next era while this one blooms — and the
 *      camera follows once the bloom is done.
 *   2. The camera pulls back to show every era, holds, and the photos shrink away.
 *   3. Rings ripple out from the middle, one for every batch; the wordmark arrives on a swoosh,
 *      the college's name beneath it.
 *   4. The lockup floats into the nav's corner while the site is revealed from the
 *      centre outwards.
 */

const INK = "#ffb400"; // the college's gold: the pen, on navy
/** The batch labels on the timeline: --color-ink-muted. */
const MARK_LABEL = "rgba(255, 255, 255, 0.88)"; // the batch labels: white on navy
/** Ink flicked off the pen: a soft brown, behind the line. */
const SPLAT = "rgba(255, 198, 26, 0.92)"; // bright yellow flecks off the pen (see-through, they went muddy on navy)
const LINE_WIDTH = 13;
/** The line bitmap's size against the world's: sharp enough at the camera's zoom, and any larger costs memory and setup time. */
const LINE_TEXTURE_SCALE = 0.8;
/** The most the intro's clock moves on in one frame (ms): ordinary lag still keeps time, a long stall doesn't. */
const MAX_STEP = 250;
/** When the last era has finished shrinking away (see "Every era shrinks away"). */
const WORLD_GONE = FINALE.shrink[0] + (ERAS.length - 1) * 90 + 560;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/** Two layouts that would draw the same world. */
const sameWorld = (a: WorldLayout, b: WorldLayout) =>
  a.width === b.width &&
  a.height === b.height &&
  a.segments.join() === b.segments.join() &&
  a.shots.every((shot, i) => shot.centre.x === b.shots[i]?.centre.x && shot.centre.y === b.shots[i]?.centre.y && shot.width === b.shots[i]?.width);
const easeInCubic = (t: number) => t * t * t;
const easeInBack = (t: number) => 2.4 * t * t * t - 1.4 * t * t;

/**
 * The whole ink line, textured, as one bitmap. Dry-ink edges, uneven density and a soft
 * paper shadow come from SVG filters, which are far too slow to run every frame, so they
 * are rendered once here and the pen reveals the result.
 */
async function lineTexture(layout: WorldLayout, scale = LINE_TEXTURE_SCALE): Promise<HTMLCanvasElement> {
  const paths = layout.segments.map((d) => `<path d="${d}"/>`).join("");
  const width = Math.round(layout.width * scale);
  const height = Math.round(layout.height * scale);
  // Rasterised straight at the texture's size: the filters (the slow part, ~10 million
  // pixels of world on a phone) never run at full size only to be shrunk afterwards.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${layout.width} ${layout.height}">
    <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="wobble"/>
      <feDisplacementMap in="SourceGraphic" in2="wobble" scale="9" xChannelSelector="R" yChannelSelector="G" result="wobbly"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="7" result="tooth"/>
      <feDisplacementMap in="wobbly" in2="tooth" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="ragged"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.05" numOctaves="3" seed="9" result="pressure"/>
      <feColorMatrix in="pressure" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.65" result="grainAlpha"/>
      <feComposite in="ragged" in2="grainAlpha" operator="in" result="dry"/>
      <feDropShadow in="dry" dx="2" dy="6" stdDeviation="4.5" flood-color="#000814" flood-opacity="0.45"/>
    </filter>
    <g filter="url(#ink)" fill="none" stroke="${INK}" stroke-width="${LINE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
  </svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    // A refused canvas would give an invisible line; failing lets the plain line stand in.
    if (!ctx) throw new Error("No canvas for the line texture");
    ctx.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The intro's heavy part (the eras, the ink line, the pull-back) as a video, recorded from
 * this very component (scripts/record-intro.mjs). A phone plays it with its video hardware
 * instead of drawing it live; the patterns, the wordmark and the reveal stay live on top,
 * timed by the video's own clock. Recorded: tall phones, upright tablets, and wide screens
 * (laptops, desktops); square-ish windows draw it live.
 */
const VIDEO_END = WORLD_GONE;
const INTRO_VIDEOS = {
  /** Phones held upright (height ≥ 1.6 × width). */
  tall: { hevc: "/assets/intro/phone-720.hevc.mp4", h264: "/assets/intro/phone-720.h264.mp4" },
  /** Tablets held upright (1.25–1.6). */
  tablet: { hevc: "/assets/intro/tablet-900.hevc.mp4", h264: "/assets/intro/tablet-900.h264.mp4" },
  /** Laptops and desktops (height ≤ 0.7 × width: 16:9, 16:10). */
  wide: { hevc: "/assets/intro/wide-1280.hevc.mp4", h264: "/assets/intro/wide-1280.h264.mp4" }
};

const saveData = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

function introVideoFor(view: { width: number; height: number }): string | null {
  const ratio = view.height / view.width;
  // In between (a square-ish window, a tablet on its side): drawn live, as cropping a video
  // to fit would cut photos off.
  const kind = ratio >= 1.6 ? "tall" : ratio >= 1.25 ? "tablet" : ratio <= 0.7 ? "wide" : null;
  if (!kind) return null;
  const probe = document.createElement("video");
  if (probe.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"')) return INTRO_VIDEOS[kind].hevc;
  if (probe.canPlayType('video/mp4; codecs="avc1.640028"')) return INTRO_VIDEOS[kind].h264;
  return null;
}

type GrowingCampusIntroProps = {
  onComplete: () => void;
};

export function GrowingCampusIntro({ onComplete }: GrowingCampusIntroProps) {
  const [isSettled, setIsSettled] = useState(false);
  const [layout, setLayout] = useState<WorldLayout | null>(null);
  const [skipNextTime, setSkipNextTime] = useState(false);
  /** The video this screen plays for the eras (null: drawn live). Chosen once, as it starts. */
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const settledRef = useRef(false);
  /**
   * The intro's own clock. It survives a resize, so re-laying out the world doesn't restart
   * the intro, and it advances at most MAX_STEP a frame: a phone that stalls plays the
   * intro more slowly instead of jumping past the patterns and the wordmark to the end.
   */
  const clockRef = useRef({ elapsed: 0, last: 0 });

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const totalRef = useRef<HTMLParagraphElement>(null);
  const patternsRef = useRef<HTMLDivElement>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const shotRefs = useRef<(HTMLElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const measureRefs = useRef<(SVGPathElement | null)[]>([]);

  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    document.documentElement.classList.remove("intro-playing");
    patternsRef.current?.style.setProperty("--p", "1");
    setIsSettled(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Opted out, or prefers reduced motion: straight to the site.
    if (!shouldPlayIntro()) {
      settle();
      return;
    }
    setSkipNextTime(readIntroPreference() === "skip");
    // Recording it (?t=…) always draws live; a tall phone otherwise gets the video. On Data
    // Saver there's neither a 2 MB video nor a heavy live intro: straight to the site.
    const recording = new URLSearchParams(window.location.search).has("t");
    if (!recording && saveData()) {
      settle();
      return;
    }
    setVideoSrc(recording ? null : introVideoFor(viewport()));
    // No scrolling under the intro: the page below it isn't revealed yet.
    document.documentElement.classList.add("intro-playing");
    // Re-lay out the world only when it really changes shape (a rotation, a resized window).
    // On phones the address bar sliding in and out fires resizes that leave the world as it
    // was; rebuilding then would redraw the whole ink line mid-intro and stall it.
    const update = () => setLayout((current) => {
      const next = worldLayout(viewport());
      return current && sameWorld(current, next) ? current : next;
    });
    update();
    let wait = 0;
    const onResize = () => {
      window.clearTimeout(wait);
      wait = window.setTimeout(update, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(wait);
      window.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("intro-playing");
    };
  }, [settle]);

  useEffect(() => {
    if (!layout || settledRef.current) return;
    let frame = 0;
    let cancelled = false;
    const video = videoSrc ? videoRef.current : null;
    if (videoSrc && !video) return; // the video element mounts first

    const loadEra = (i: number) =>
      Promise.all([loadImage(layout.shots[i].era.photo.sketch), loadImage(layout.shots[i].era.photo.photo)]);

    // Everything this run makes that holds canvas memory, freed when it ends (see InkPhoto.release).
    let texture: HTMLCanvasElement | null = null;
    const inks: (InkPhoto | null)[] = layout.shots.map(() => null);
    const free = () => {
      inks.forEach((ink) => ink?.release());
      if (texture) texture.width = texture.height = 0;
    };

    // Start as soon as the line and the first era are ready; the rest arrive while it plays.
    // Neither is essential: without the texture the line is plain ink, and a photo that
    // fails is simply left out. The intro carries on rather than vanishing.
    // Recording the intro as a video (?t=…&capture=1, see scripts/record-intro.mjs): drawn at
    // full phone sharpness, with a finer ink texture than a live phone could afford.
    const capture = new URLSearchParams(window.location.search).get("capture") === "1";
    const heavy = video
      ? Promise.resolve([null, null] as const)
      : Promise.all([lineTexture(layout, capture ? 1.25 : LINE_TEXTURE_SCALE).catch(() => null), loadEra(0).catch(() => null)]);
    heavy
      .then(([lineBitmap, firstEra]) => {
        texture = lineBitmap;
        const section = sectionRef.current;
        const stage = stageRef.current;
        const world = worldRef.current;
        const lineCanvas = lineCanvasRef.current;
        const line = lineCanvas?.getContext("2d");
        const lockup = lockupRef.current;
        const patterns = patternsRef.current;
        const revealRoot = document.querySelector<HTMLElement>("[data-reveal-root]");
        const brandTarget = document.querySelector<HTMLElement>("[data-brand-target]");
        if (cancelled) return;
        // Nothing to draw on (the phone refused the canvas): straight to the site, rather than blank paper.
        if (!section || !stage || !world || !lineCanvas || !line || !lockup || !patterns) {
          settle();
          return;
        }

        const swoosh = lockup.querySelector<SVGPathElement>(".brand__swoosh-reveal");
        const name = lockup.querySelector<HTMLElement>(".brand__name");
        const byline = lockup.querySelector<HTMLElement>(".brand__by");
        const bylineFull = lockup.querySelector<HTMLElement>(".brand__by-full");
        const bylineShort = lockup.querySelector<HTMLElement>(".brand__by-short");

        const makeInk = (i: number, [sketch, photo]: HTMLImageElement[]) => {
          const canvas = canvasRefs.current[i];
          if (!canvas || cancelled) return;
          try {
            inks[i] = new InkPhoto(canvas, sketch, photo, layout.shots[i].era.photo.inkOrigin, 11 + i * 17);
          } catch {
            // Out of canvas memory, most likely: this era goes without its photo.
          }
        };
        if (firstEra) makeInk(0, firstEra);

        // The video draws the eras: the live world isn't shown, and the video starts. If the
        // phone won't play it (Low Power Mode blocks autoplay, say), straight to the site.
        if (video) {
          world.style.display = "none";
          lineCanvas.style.display = "none";
          if (backdropRef.current) backdropRef.current.style.display = "none";
          if (totalRef.current) totalRef.current.style.display = "none";
          video.addEventListener("error", settle, { once: true });
          // Its last frame can hold the last photo's final speck: the live paper takes over cleanly.
          video.addEventListener("ended", () => (video.style.visibility = "hidden"), { once: true });
          video.play().catch(settle);
        }

        const segments = layout.segments.map((d, i) => ({
          path: new Path2D(d),
          measure: measureRefs.current[i],
          length: measureRefs.current[i]?.getTotalLength() ?? 0,
          window: segmentTiming(i)
        }));
        // Every batch between the eras, placed on its stroke once: where, which way is "out".
        const tall = layout.height > layout.width;
        const labelFont = `600 ${tall ? 50 : 28}px ${getComputedStyle(document.body).fontFamily}`;
        const marks = batchMarks().map((mark) => {
          const { measure, length } = segments[mark.segment];
          const at = measure?.getPointAtLength(length * mark.along);
          const ahead = measure?.getPointAtLength(Math.min(length, length * mark.along + 4));
          const tx = (ahead?.x ?? 0) - (at?.x ?? 0);
          const ty = (ahead?.y ?? 0) - (at?.y ?? 0);
          const len = Math.hypot(tx, ty) || 1;
          let nx = -ty / len;
          let ny = tx / len;
          // Labels go outward: above the line when it runs across, away from the middle when it climbs.
          if (tall ? Math.sign(nx) !== Math.sign((at?.x ?? 0) - 730) : ny > 0) {
            nx = -nx;
            ny = -ny;
          }
          return { ...mark, x: at?.x ?? 0, y: at?.y ?? 0, nx, ny, r: batchDotRadius(mark.students), label: `${mark.year} · ${mark.students}` };
        });

        // A point on a stroke, pushed out to one side of it.
        const beside = (segment: number, along: number, offset: number) => {
          const { measure, length } = segments[segment];
          const at = measure?.getPointAtLength(length * Math.min(1, Math.max(0, along)));
          const ahead = measure?.getPointAtLength(Math.min(length, length * along + 4));
          const tx = (ahead?.x ?? 0) - (at?.x ?? 0);
          const ty = (ahead?.y ?? 0) - (at?.y ?? 0);
          const len = Math.hypot(tx, ty) || 1;
          return { x: (at?.x ?? 0) + (-ty / len) * offset, y: (at?.y ?? 0) + (tx / len) * offset };
        };

        // Every year since the founding, faint, in an even grid on a slower layer.
        const backdrop = backdropRef.current;
        if (backdrop) {
          backdrop.replaceChildren(
            ...backdropYears(layout).map(({ year, x, y }) => {
              const numeral = document.createElement("span");
              numeral.textContent = String(year);
              numeral.style.left = `${x}px`;
              numeral.style.top = `${y}px`;
              return numeral;
            })
          );
        }

        // A few ink spatters flicked off the pen as it passes.
        const splats = inkSplats().map((splat) => {
          const { x, y } = beside(splat.segment, splat.along, splat.offset);
          const path = new Path2D();
          const scale = splat.radius / 30;
          for (const blob of makeInkBlobs(100, { x: 0.5, y: 0.5 }, splat.seed, { extent: 0.3, fingers: 5, drops: 3, spatter: 7, roughness: 0.35 })) {
            const outline = blobOutline({ ...blob, x: (blob.x - 50) * scale, y: (blob.y - 50) * scale, radius: blob.radius * scale }, 1, 28);
            if (outline.length > 2) path.addPath(new Path2D(outlineToPath(outline)), new DOMMatrix().translate(x, y));
          }
          return { ...splat, path };
        });

        // Where the pen's head is at any moment: the camera follows this.
        const penAt = (time: number) => {
          let i = segments.length - 1;
          while (i > 0 && time < segments[i].window[0]) i -= 1;
          const { measure, length } = segments[i];
          const point = measure?.getPointAtLength(length * penProgress(i, time));
          return { x: point?.x ?? 0, y: point?.y ?? 0 };
        };
        const blots = layout.shots.map((shot, i) => {
          const blob = makeInkBlobs(100, { x: 0.5, y: 0.5 }, 5 + i, COLOUR_SPREAD)[0];
          return {
            path: new Path2D(outlineToPath(blobOutline({ ...blob, x: 0, y: 0, radius: 30 }, 1))),
            centre: shot.centre,
            window: stopTiming(i).blot
          };
        });

        // Where the wordmark starts, measured once as the float begins. Its destination is
        // re-read every frame, so it lands exactly even if the nav is still settling.
        let floatFrom: DOMRect | null = null;
        let floatOrigin: DOMRect | null = null;
        const targetName = brandTarget?.querySelector<HTMLElement>(".brand__name") ?? brandTarget;
        // The letters themselves, not the boxes around them: the two wordmarks have different
        // line heights, and matching boxes left the flying one a little high, then a jump.
        const letters = (el: HTMLElement) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getBoundingClientRect();
        };

        // Dev aid: ?t=2900 freezes the intro at 2.9 s so a single frame can be inspected.
        const frozenParam = new URLSearchParams(window.location.search).get("t");
        let frozen = frozenParam === null ? NaN : Number(frozenParam);
        let worldDropped = Boolean(video);
        // While frozen, a recorder can move the frozen moment and wait for it to be drawn.
        if (Number.isFinite(frozen)) {
          (window as unknown as { __introAt?: (ms: number) => Promise<void> }).__introAt = (ms) =>
            new Promise((resolve) => {
              frozen = ms;
              requestAnimationFrame((now) => {
                tick(now);
                requestAnimationFrame(() => resolve());
              });
            });
        }
        let erasLoaded = 1;
        const markReady = () => {
          if (erasLoaded >= layout.shots.length) (window as unknown as { __introReady?: boolean }).__introReady = true;
        };

        const tick = (now: number) => {
          if (settledRef.current) {
            free();
            return;
          }
          const clock = clockRef.current;
          if (clock.last) clock.elapsed += Math.min(MAX_STEP, Math.max(0, now - clock.last));
          clock.last = now;
          // While the video plays, it keeps the time (it may pause to load; the rest waits for it).
          if (video) {
            const at = video.currentTime * 1000;
            clock.elapsed = !video.ended && at < VIDEO_END - 20 ? at : Math.max(clock.elapsed, VIDEO_END);
          }
          const t = Number.isFinite(frozen) ? frozen : clock.elapsed;
          const view = viewport();
          const dpr = Math.min(capture ? 3 : 2, window.devicePixelRatio || 1);
          if (lineCanvas.width !== Math.round(view.width * dpr) || lineCanvas.height !== Math.round(view.height * dpr)) {
            lineCanvas.width = Math.round(view.width * dpr);
            lineCanvas.height = Math.round(view.height * dpr);
          }

          /* --- 1. Eras --- */
          // Once every era has shrunk away, the world, its years and the line are dropped
          // altogether (and their memory freed), so the patterns and the wordmark have the
          // phone to themselves. On a slow phone this is where it used to stall.
          if (t >= WORLD_GONE && !worldDropped) {
            worldDropped = true;
            world.style.display = "none";
            if (backdrop) backdrop.style.display = "none";
            lineCanvas.style.display = "none";
            free();
          }
          if (!worldDropped) {
            // The camera, the line and the photos.
            const camera = cameraAt(t, layout, view, penAt);
            const ox = view.width / 2 - camera.x * camera.scale;
            const oy = view.height / 2 - camera.y * camera.scale;
            world.style.transform = `translate(${ox}px, ${oy}px) scale(${camera.scale})`;
            if (backdrop) {
              // Slower than the world: the years drift past behind the photos.
              const k = camera.scale * BACKDROP_PARALLAX;
              backdrop.style.transform = `translate(${view.width / 2 - camera.x * k}px, ${view.height / 2 - camera.y * k}px) scale(${k})`;
              backdrop.style.opacity = `${windowProgress(t, 0, 900) * (1 - windowProgress(t, ...FINALE.shrink))}`;
            }

            // The line: stroke as far as the pen has got, then fill that with the textured ink.
            line.setTransform(1, 0, 0, 1, 0, 0);
            line.globalCompositeOperation = "source-over";
            line.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
            line.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * ox, dpr * oy);
            line.lineCap = "round";
            // With the texture, a wide stroke only says how far the pen has got; without it,
            // the stroke is the ink itself.
            line.lineWidth = texture ? LINE_WIDTH * 3.6 : LINE_WIDTH;
            line.strokeStyle = texture ? "#000" : INK;
            for (const [i, segment] of segments.entries()) {
              // Slow through each photo, quick between them, never stopping.
              const p = penProgress(i, t);
              if (p <= 0) continue;
              line.setLineDash([segment.length * p, segment.length + 1]);
              line.stroke(segment.path);
            }
            line.setLineDash([]);
            if (texture) {
              line.globalCompositeOperation = "source-in";
              // Only the part of the world on screen: on a phone the camera sees a sliver of a
              // tall world, and copying all of it every frame is most of a frame's work.
              const left = Math.max(0, -ox / camera.scale);
              const top = Math.max(0, -oy / camera.scale);
              const right = Math.min(layout.width, (view.width - ox) / camera.scale);
              const bottom = Math.min(layout.height, (view.height - oy) / camera.scale);
              if (right > left && bottom > top) {
                const kx = texture.width / layout.width;
                const ky = texture.height / layout.height;
                line.drawImage(texture, left * kx, top * ky, (right - left) * kx, (bottom - top) * ky, left, top, right - left, bottom - top);
              }
            }

            // Each blot drops where the pen lands, under the photo.
            line.globalCompositeOperation = "source-over";
            line.fillStyle = INK;
            for (const blot of blots) {
              const p = windowProgress(t, ...blot.window);
              if (p <= 0) continue;
              const scale = easeOutCubic(p) + Math.sin(p * Math.PI) * 0.25;
              line.save();
              line.translate(blot.centre.x, blot.centre.y);
              line.scale(scale, scale);
              line.fill(blot.path);
              line.restore();
            }

            // Spatters land beneath the line as the pen flicks past.
            line.globalCompositeOperation = "destination-over";
            line.fillStyle = SPLAT;
            for (const splat of splats) {
              const pop = windowProgress(penProgress(splat.segment, t), splat.along, splat.along + 0.02);
              if (pop <= 0) continue;
              line.globalAlpha = easeOutCubic(pop);
              line.fill(splat.path);
            }
            line.globalAlpha = 1;
            line.globalCompositeOperation = "source-over";

            // Each batch drops onto the line as the pen passes it: a tick, a dot sized by its
            // intake, and its year. By the pull-back the line reads as the whole timeline.
            line.font = labelFont;
            line.textBaseline = "middle";
            for (const mark of marks) {
              const pop = windowProgress(penProgress(mark.segment, t), mark.along, mark.along + 0.03);
              if (pop <= 0) continue;
              const grow = easeOutCubic(pop) + Math.sin(pop * Math.PI) * 0.2;
              // A bead on the line, sized by the batch…
              line.fillStyle = INK;
              line.beginPath();
              line.arc(mark.x, mark.y, mark.r * grow, 0, Math.PI * 2);
              line.fill();
              // …and its year, set clear of the line on the outward side, reading away from it.
              line.globalAlpha = Math.min(1, pop * 1.4);
              line.fillStyle = MARK_LABEL;
              line.textAlign = Math.abs(mark.nx) > 0.5 ? (mark.nx > 0 ? "left" : "right") : "center";
              const out = mark.r + (tall ? 30 : 22);
              line.fillText(mark.label, mark.x + mark.nx * out, mark.y + mark.ny * out);
              line.globalAlpha = 1;
            }

            layout.shots.forEach((shot, i) => {
              const timing = stopTiming(i);
              // Waiting faintly in black and white from the start; firm as the pen arrives.
              const appear = windowProgress(t, 0, 600);
              const firm = easeInOutCubic(windowProgress(t, ...timing.firm));
              inks[i]?.draw(appear * (GHOST_OPACITY + (1 - GHOST_OPACITY) * firm), windowProgress(t, ...timing.ink));
              const figure = shotRefs.current[i];
              if (!figure) return;
              figure.classList.toggle("journey-shot--captioned", t > timing.arrive);

              /* --- 2. Every era shrinks away, one after another --- */
              const gone = windowProgress(t, FINALE.shrink[0] + i * 90, FINALE.shrink[0] + i * 90 + 560);
              figure.style.transform = `rotate(${shot.rotation + gone * 10}deg) scale(${Math.max(0.001, 1 - easeInBack(gone))})`;
              figure.style.opacity = `${1 - easeInCubic(gone)}`;
            });
          }

          const shrink = windowProgress(t, ...FINALE.shrink);
          lineCanvas.style.opacity = `${1 - shrink}`;
          const total = totalRef.current;
          if (total && !video) {
            const p = windowProgress(t, ...FINALE.total);
            total.style.opacity = `${p * (1 - shrink)}`;
            total.style.transform = `translate(-50%, ${(1 - easeOutCubic(p)) * 14}px)`;
          }

          /* --- 3. Patterns, then the wordmark on its swoosh --- */
          patterns.style.setProperty("--p", `${windowProgress(t, ...FINALE.patterns)}`);

          const swooshP = windowProgress(t, ...FINALE.swoosh);
          lockup.style.opacity = swooshP > 0 ? "1" : "0";
          swoosh?.style.setProperty("stroke-dashoffset", `${1 - easeOutCubic(swooshP)}`);
          if (name) {
            // The word is uncovered just behind the swoosh's head.
            const uncovered = easeOutCubic(windowProgress(swooshP, 0.08, 0.85));
            name.style.clipPath = `inset(-20% ${(1 - uncovered) * 100}% -20% -5%)`;
            name.style.transform = `translateY(${(1 - uncovered) * 0.06}em)`;
          }
          if (byline) {
            const p = easeOutCubic(windowProgress(t, ...FINALE.byline));
            byline.style.opacity = `${p}`;
            byline.style.transform = `translateY(${(1 - p) * 0.5}em)`;
          }

          /* --- 4. Float to the corner, reveal the site from the centre out --- */
          const floatP = windowProgress(t, ...FINALE.float);
          if (floatP > 0 && !floatFrom && targetName && revealRoot) {
            revealRoot.classList.add("landing-ui--revealing");
            // Match the wordmarks themselves: the bylines differ in width, the wordmark doesn't.
            // It sits at the lockup's top-left, which is also the transform's origin.
            floatFrom = letters(name ?? lockup);
            floatOrigin = lockup.getBoundingClientRect();
          }
          if (floatFrom && floatOrigin && targetName) {
            const to = letters(targetName);
            const e = easeInOutCubic(floatP);
            const scale = 1 + (to.width / floatFrom.width - 1) * e;
            // The lockup scales from its own top-left corner, so the letters (a little inside
            // it) are placed by solving for where that corner must go.
            const x = floatFrom.left + (to.left - floatFrom.left) * e - floatOrigin.left - scale * (floatFrom.left - floatOrigin.left);
            const y = floatFrom.top + (to.top - floatFrom.top) * e - floatOrigin.top - scale * (floatFrom.top - floatOrigin.top);
            lockup.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
            // White over the intro's navy, the header's navy once the opening page is under it:
            // the colour follows the widening hole as it passes the letters, not a timer.
            if (name) {
              const cx = floatFrom.left + (to.left - floatFrom.left) * e + (floatFrom.width * scale) / 2;
              const cy = floatFrom.top + (to.top - floatFrom.top) * e + (floatFrom.height * scale) / 2;
              const reveal = easeInOutCubic(windowProgress(t, ...FINALE.reveal));
              const feather = Math.min(view.width, view.height) * 0.22;
              const radius = reveal * (Math.hypot(view.width, view.height) / 2 + feather * 1.2);
              const distance = Math.hypot(cx - view.width / 2, cy - view.height / 2);
              const open = Math.min(1, Math.max(0, (radius - distance) / feather));
              name.style.color = `color-mix(in srgb, #123e7c ${Math.round(open * 100)}%, #ffffff)`;
            }
            // The full college name gives way to "HKBK CE" as the lockup shrinks into the nav.
            const swap = easeInOutCubic(windowProgress(floatP, 0.42, 0.62));
            if (bylineFull) bylineFull.style.opacity = `${1 - swap}`;
            if (bylineShort) bylineShort.style.opacity = `${swap}`;
            // As it settles into place, the header's crest and college line fade in around it.
            if (floatP > 0.8) document.querySelector(".landing")?.classList.add("landing--brand-in");
          }

          const revealP = windowProgress(t, ...FINALE.reveal);
          if (revealP > 0) {
            // The site has been painted beneath the intro all along (so it counts as shown
            // at once); the reveal opens a widening hole in the intro's paper over it.
            const feather = Math.min(view.width, view.height) * 0.22;
            const radius = easeInOutCubic(revealP) * (Math.hypot(view.width, view.height) / 2 + feather * 1.2);
            stage.style.setProperty("--hole-r", `${radius}px`);
            stage.style.setProperty("--hole-feather", `${feather}px`);
            section.classList.add("ink-intro--revealing");
            revealRoot?.style.setProperty("--reveal-p", `${easeOutCubic(revealP)}`);
          }

          if (t >= INTRO_END && !Number.isFinite(frozen)) {
            settle();
            return;
          }
          if (!Number.isFinite(frozen)) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        markReady();

        // An era that hasn't arrived yet simply isn't drawn until it has. (A frozen frame,
        // which draws only once, draws again as each one arrives.)
        if (!video) layout.shots.slice(1).forEach((_, k) =>
          void loadEra(k + 1)
            .then((images) => {
              makeInk(k + 1, images);
              erasLoaded += 1;
              markReady();
              if (Number.isFinite(frozen)) frame = requestAnimationFrame(tick);
            })
            .catch(() => undefined)
        );
      })
      .catch(settle);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      free();
    };
  }, [layout, settle, videoSrc]);

  return (
    <>
      <section
        className={`ink-intro ${isSettled ? "ink-intro--settled" : ""}`}
        ref={sectionRef}
        aria-label="HKBK through the years, 1998 to today"
      >
        {/* Everything the intro draws. Unmounted once it ends, which frees its canvases. */}
        {!isSettled && (
          <div className="ink-intro__stage" ref={stageRef}>
          <div className="ink-intro__paper" aria-hidden="true" />
          {videoSrc && <video ref={videoRef} className="ink-intro__video" src={videoSrc} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} />}
          {/* Huge faint years behind everything, moving slower than the world (parallax). */}
          <div className="journey-backdrop" ref={backdropRef} aria-hidden="true" />
          {/* Drawn in screen space, behind the photos. */}
          <canvas className="journey-ink-line" ref={lineCanvasRef} aria-hidden="true" />
          {layout && (
            <>
              {/* Only used to measure the line's segments. */}
              <svg className="journey-measure" aria-hidden="true">
                {layout.segments.map((d, i) => (
                  <path d={d} key={i} ref={(el) => { measureRefs.current[i] = el; }} />
                ))}
              </svg>
              <div className="journey-world" ref={worldRef} style={{ width: layout.width, height: layout.height }} aria-hidden="true">
                {layout.shots.map((shot, i) => (
                  <figure
                    className="journey-shot"
                    key={shot.era.year}
                    ref={(el) => { shotRefs.current[i] = el; }}
                    style={{
                      left: shot.centre.x - shot.width / 2,
                      top: shot.centre.y - shot.height / 2,
                      width: shot.width,
                      height: shot.height,
                      transform: `rotate(${shot.rotation}deg)`
                    } as CSSProperties}
                  >
                    <canvas className="journey-shot__canvas" ref={(el) => { canvasRefs.current[i] = el; }} />
                    <figcaption>
                      <span className="journey-shot__year">{shot.era.year}</span>
                      <span className="journey-shot__title">{shot.era.title}</span>
                      <span className="journey-shot__detail">{shot.era.detail}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
          <p className="journey-total" ref={totalRef} aria-hidden="true">
            {STUDENTS_SINCE_1998.toLocaleString("en-IN")} engineering students since 1998.
          </p>
          </div>
        )}
        <div ref={patternsRef} className="side-patterns-host">
          <IntroRings />
        </div>
        <p className="sr-only">
          HKBK College of Engineering through the years:{" "}
          {ERAS.map((era) => `${era.year}, ${era.title.toLowerCase()} — ${era.detail}`).join("; ")}.{" "}
          {STUDENTS_SINCE_1998.toLocaleString("en-IN")} engineering students since 1998.
        </p>
      </section>

      {/* Above the site, so it can float into the nav while the site is revealed. */}
      <div className={`intro-lockup ${isSettled ? "intro-lockup--settled" : ""}`} ref={lockupRef} aria-hidden="true">
        <IntroLockup />
      </div>

      {!isSettled && (
        <div className="ink-intro__controls">
          <label className="ink-intro__remember">
            <input
              type="checkbox"
              checked={skipNextTime}
              onChange={(event) => {
                setSkipNextTime(event.target.checked);
                writeIntroPreference(event.target.checked ? "skip" : "play");
              }}
            />
            Don’t play the intro next time
          </label>
          <button className="ink-intro__skip" type="button" onClick={settle}>Skip intro <span aria-hidden="true">→</span></button>
        </div>
      )}
    </>
  );
}

/**
 * The intro's own lockup, in the shape it animates: "Alumnity." drawn in on a gold swoosh,
 * then the college under it, with its crest. It floats into the header's "Alumnity." at the end.
 */
const SWOOSH_CENTRELINE = "M10 40C92 14 200 8 290 26S372 38 392 16";

function IntroLockup() {
  return (
    <span className="brand intro-brand">
      <span className="brand__name">
        Alumnity<span className="brand__dot">.</span>
      </span>
      <svg className="brand__swoosh" viewBox="0 0 400 56" aria-hidden="true">
        <mask id="intro-swoosh" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="56">
          <path className="brand__swoosh-reveal" d={SWOOSH_CENTRELINE} pathLength={1} />
        </mask>
        <path className="brand__swoosh-ink" mask="url(#intro-swoosh)" d="M8 43C90 12 200 3 292 21C340 30 372 29 395 12C374 36 338 41 289 32C200 17 94 22 8 43Z" />
      </svg>
      <span className="brand__by">
        <span className="brand__by-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand__crest" src={LOGO} alt="" width={256} height={256} />
          HKBK College of Engineering
        </span>
        <span className="brand__by-short">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand__crest" src={LOGO} alt="" width={256} height={256} />
          HKBK College of Engineering
        </span>
      </span>
    </span>
  );
}

/**
 * The finale's rings: one after another out from the middle, behind the wordmark, a ring
 * for every batch, gold among the college's blue. Driven by the patterns' progress (--p on
 * their host); they settle as a faint halo before the page opens.
 */
const RINGS = 4;

function IntroRings() {
  return (
    <div className="intro-rings" aria-hidden="true">
      {/* Ripples that keep pulsing out while the wordmark is up: gold, light blue, white. */}
      {Array.from({ length: 2 }, (_, i) => (
        <span key={`w${i}`} className={`intro-rings__wave intro-rings__wave--${i % 3}`} style={{ animationDelay: `${i * 1.6}s` }} />
      ))}
      {Array.from({ length: RINGS }, (_, i) => (
        <span key={i} className={i % 3 === 2 ? "intro-rings__ring intro-rings__ring--gold" : "intro-rings__ring"} style={{ "--d": `${(i / RINGS) * 0.55}`, "--r": `${1.2 + i * 0.95}` } as CSSProperties} />
      ))}
    </div>
  );
}
