"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ERAS, STUDENTS_SINCE_1998 } from "../lib/eras";
import { blobOutline, COLOUR_SPREAD, easeInOutCubic, easeOutCubic, makeInkBlobs, outlineToPath, windowProgress } from "../lib/ink";
import { cameraAt, FINALE, INTRO_END, segmentTiming, stopTiming, worldLayout, type WorldLayout } from "../lib/journey";
import { BrandLockup } from "./brand-lockup";
import { InkPhoto } from "./ink-photo";
import { SidePatterns } from "./side-patterns";

/*
 * The intro, on one timeline:
 *   1. Eras. One continuous red ink line runs under each era's photo; where it lands a
 *      blot drops, the pencil sketch develops and an ink splotch soaks the colour in.
 *      The pen never stops — it heads for the next era while this one blooms — and the
 *      camera follows once the bloom is done.
 *   2. The camera pulls back to show every era, holds, and the photos shrink away.
 *   3. Hand-drawn patterns grow in from the sides; the wordmark arrives on a swoosh,
 *      the college's name beneath it.
 *   4. The lockup floats into the nav's corner while the site is revealed from the
 *      centre outwards.
 */

const INK = "#a83932";
const LINE_WIDTH = 13;
/** The camera never shows the world much above this scale, so the line bitmap needn't be larger. */
const LINE_TEXTURE_SCALE = 0.8;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
const easeInCubic = (t: number) => t * t * t;
const easeInBack = (t: number) => 2.4 * t * t * t - 1.4 * t * t;

/**
 * The whole ink line, textured, as one bitmap. Dry-ink edges, uneven density and a soft
 * paper shadow come from SVG filters, which are far too slow to run every frame, so they
 * are rendered once here and the pen reveals the result.
 */
async function lineTexture(layout: WorldLayout): Promise<HTMLCanvasElement> {
  const paths = layout.segments.map((d) => `<path d="${d}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
    <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="wobble"/>
      <feDisplacementMap in="SourceGraphic" in2="wobble" scale="9" xChannelSelector="R" yChannelSelector="G" result="wobbly"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="7" result="tooth"/>
      <feDisplacementMap in="wobbly" in2="tooth" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="ragged"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.05" numOctaves="3" seed="9" result="pressure"/>
      <feColorMatrix in="pressure" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.65" result="grainAlpha"/>
      <feComposite in="ragged" in2="grainAlpha" operator="in" result="dry"/>
      <feDropShadow in="dry" dx="2" dy="6" stdDeviation="4.5" flood-color="#2b1d12" flood-opacity="0.3"/>
    </filter>
    <g filter="url(#ink)" fill="none" stroke="${INK}" stroke-width="${LINE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
  </svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(layout.width * LINE_TEXTURE_SCALE);
    canvas.height = Math.round(layout.height * LINE_TEXTURE_SCALE);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type GrowingCampusIntroProps = {
  onComplete: () => void;
};

export function GrowingCampusIntro({ onComplete }: GrowingCampusIntroProps) {
  const [isSettled, setIsSettled] = useState(false);
  const [layout, setLayout] = useState<WorldLayout | null>(null);
  const settledRef = useRef(false);
  /** Survives a resize, so re-laying out the world doesn't restart the intro. */
  const startRef = useRef<number | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
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
    patternsRef.current?.style.setProperty("--p", "1");
    setIsSettled(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return;
    }
    const update = () => setLayout(worldLayout(viewport()));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [settle]);

  useEffect(() => {
    if (!layout || settledRef.current) return;
    let frame = 0;
    let cancelled = false;

    Promise.all([
      lineTexture(layout),
      ...layout.shots.map((shot) => Promise.all([loadImage(shot.era.photo.sketch), loadImage(shot.era.photo.photo)]))
    ])
      .then(([texture, ...images]) => {
        const section = sectionRef.current;
        const world = worldRef.current;
        const lineCanvas = lineCanvasRef.current;
        const line = lineCanvas?.getContext("2d");
        const lockup = lockupRef.current;
        const patterns = patternsRef.current;
        const revealRoot = document.querySelector<HTMLElement>("[data-reveal-root]");
        const brandTarget = document.querySelector<HTMLElement>("[data-brand-target]");
        if (cancelled || !section || !world || !lineCanvas || !line || !lockup || !patterns) return;

        const swoosh = lockup.querySelector<SVGPathElement>(".brand__swoosh-reveal");
        const name = lockup.querySelector<HTMLElement>(".brand__name");
        const byline = lockup.querySelector<HTMLElement>(".brand__by");
        const bylineFull = lockup.querySelector<HTMLElement>(".brand__by-full");
        const bylineShort = lockup.querySelector<HTMLElement>(".brand__by-short");

        const inks = layout.shots.map((shot, i) => {
          const canvas = canvasRefs.current[i];
          return canvas ? new InkPhoto(canvas, images[i][0], images[i][1], shot.era.photo.inkOrigin, 11 + i * 17) : null;
        });
        const segments = layout.segments.map((d, i) => ({
          path: new Path2D(d),
          length: measureRefs.current[i]?.getTotalLength() ?? 0,
          window: segmentTiming(i)
        }));
        const blots = layout.shots.map((shot, i) => {
          const blob = makeInkBlobs(100, { x: 0.5, y: 0.5 }, 5 + i, COLOUR_SPREAD)[0];
          return {
            path: new Path2D(outlineToPath(blobOutline({ ...blob, x: 0, y: 0, radius: 30 }, 1))),
            centre: shot.centre,
            window: stopTiming(i).blot
          };
        });

        // Measured once, when the float begins: how far the lockup travels and shrinks.
        let float: { dx: number; dy: number; scale: number } | null = null;

        // Dev aid: ?t=2900 freezes the intro at 2.9 s so a single frame can be inspected.
        const frozenParam = new URLSearchParams(window.location.search).get("t");
        const frozen = frozenParam === null ? NaN : Number(frozenParam);
        startRef.current ??= performance.now();

        const tick = (now: number) => {
          if (settledRef.current) return;
          const t = Number.isFinite(frozen) ? frozen : now - (startRef.current ?? now);
          const view = viewport();
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          if (lineCanvas.width !== Math.round(view.width * dpr) || lineCanvas.height !== Math.round(view.height * dpr)) {
            lineCanvas.width = Math.round(view.width * dpr);
            lineCanvas.height = Math.round(view.height * dpr);
          }

          /* --- 1. Eras --- */
          const camera = cameraAt(t, layout, view);
          const ox = view.width / 2 - camera.x * camera.scale;
          const oy = view.height / 2 - camera.y * camera.scale;
          world.style.transform = `translate(${ox}px, ${oy}px) scale(${camera.scale})`;

          // The line: stroke as far as the pen has got, then fill that with the textured ink.
          line.setTransform(1, 0, 0, 1, 0, 0);
          line.globalCompositeOperation = "source-over";
          line.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
          line.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * ox, dpr * oy);
          line.lineCap = "round";
          line.lineWidth = LINE_WIDTH * 3.6;
          line.strokeStyle = "#000";
          for (const segment of segments) {
            const p = easeInOutCubic(windowProgress(t, ...segment.window));
            if (p <= 0) continue;
            line.setLineDash([segment.length * p, segment.length + 1]);
            line.stroke(segment.path);
          }
          line.setLineDash([]);
          line.globalCompositeOperation = "source-in";
          line.drawImage(texture, 0, 0, layout.width, layout.height);

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

          layout.shots.forEach((shot, i) => {
            const timing = stopTiming(i);
            inks[i]?.draw(windowProgress(t, ...timing.sketch), windowProgress(t, ...timing.ink));
            const figure = shotRefs.current[i];
            if (!figure) return;
            figure.classList.toggle("journey-shot--captioned", t > timing.sketch[1]);

            /* --- 2. Every era shrinks away, one after another --- */
            const gone = windowProgress(t, FINALE.shrink[0] + i * 90, FINALE.shrink[0] + i * 90 + 560);
            figure.style.transform = `rotate(${shot.rotation + gone * 10}deg) scale(${Math.max(0.001, 1 - easeInBack(gone))})`;
            figure.style.opacity = `${1 - easeInCubic(gone)}`;
          });

          const shrink = windowProgress(t, ...FINALE.shrink);
          lineCanvas.style.opacity = `${1 - shrink}`;
          const total = totalRef.current;
          if (total) {
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
          if (floatP > 0 && !float && brandTarget && revealRoot) {
            revealRoot.classList.add("landing-ui--revealing");
            revealRoot.style.setProperty("--reveal-r", "0px");
            const from = lockup.getBoundingClientRect();
            const to = brandTarget.getBoundingClientRect();
            float = { dx: to.left - from.left, dy: to.top - from.top, scale: to.width / from.width };
          }
          if (float) {
            const e = easeInOutCubic(floatP);
            // The full college name gives way to "HKBK CE" as the lockup shrinks into the nav.
            const swap = easeInOutCubic(windowProgress(floatP, 0.42, 0.62));
            if (bylineFull) bylineFull.style.opacity = `${1 - swap}`;
            if (bylineShort) bylineShort.style.opacity = `${swap}`;
            lockup.style.transform = `translate(-50%, -50%) translate(${float.dx * e}px, ${float.dy * e}px) scale(${1 + (float.scale - 1) * e})`;
          }

          const revealP = windowProgress(t, ...FINALE.reveal);
          if (revealP > 0 && revealRoot) {
            section.classList.add("ink-intro--revealing");
            const feather = Math.min(view.width, view.height) * 0.22;
            const radius = easeInOutCubic(revealP) * (Math.hypot(view.width, view.height) / 2 + feather * 1.2);
            revealRoot.style.setProperty("--reveal-r", `${radius}px`);
            revealRoot.style.setProperty("--reveal-feather", `${feather}px`);
            revealRoot.style.setProperty("--reveal-p", `${easeOutCubic(revealP)}`);
          }

          if (t >= INTRO_END && !Number.isFinite(frozen)) {
            settle();
            return;
          }
          if (!Number.isFinite(frozen)) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(settle);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [layout, settle]);

  return (
    <>
      <section
        className={`ink-intro ${isSettled ? "ink-intro--settled" : ""}`}
        ref={sectionRef}
        aria-label="HKBK through the years, 1998 to today"
      >
        <div className="ink-intro__paper" aria-hidden="true" />
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
          {STUDENTS_SINCE_1998.toLocaleString("en-IN")} students since 1998.
        </p>
        <div ref={patternsRef} className="side-patterns-host">
          <SidePatterns />
        </div>
        <p className="sr-only">
          HKBK College of Engineering through the years:{" "}
          {ERAS.map((era) => `${era.year}, ${era.title.toLowerCase()} — ${era.detail}`).join("; ")}.{" "}
          {STUDENTS_SINCE_1998.toLocaleString("en-IN")} students since 1998.
        </p>
      </section>

      {/* Above the site, so it can float into the nav while the site is revealed. */}
      <div className={`intro-lockup ${isSettled ? "intro-lockup--settled" : ""}`} ref={lockupRef} aria-hidden="true">
        <BrandLockup byline="both" />
      </div>

      {!isSettled && <button className="ink-intro__skip" type="button" onClick={settle}>Skip intro <span aria-hidden="true">→</span></button>}
    </>
  );
}
