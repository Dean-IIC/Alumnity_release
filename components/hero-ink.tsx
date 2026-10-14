"use client";

import { useEffect, useRef, type MouseEventHandler } from "react";
import { HERO_PHOTO } from "../lib/campus";
import { COLOUR_SPREAD, SKETCH_SPREAD, windowProgress } from "../lib/ink";
import { InkPhoto } from "./ink-photo";

/*
 * The hero photo, in the intro's own language: one photograph of the campus in an
 * irregular ink splotch, straight on the paper. It waits as a pencil sketch and, when the
 * site is up, the ink blooms its colour in once — the reveal the intro uses for each era.
 * Then it is still: nothing animates after that.
 */

/** The colour soaks in over the waiting sketch. */
const BLOOM = [200, 1500] as const;

/*
 * A smaller colour core inside a wide pencil fringe: the headline overlaps the photo's
 * pale sketched edge, never its darkest colour, so it stays readable.
 */
const HERO_SPREAD = {
  sketch: { ...SKETCH_SPREAD, extent: 0.56 },
  colour: { ...COLOUR_SPREAD, extent: 0.4 }
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

type HeroInkProps = {
  /** True once the site is showing; the bloom waits for it. */
  active: boolean;
  onExplore: MouseEventHandler<HTMLAnchorElement>;
};

export function HeroInk({ active, onExplore }: HeroInkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<InkPhoto | null>(null);
  const bloomed = useRef(false);

  // Ready as a sketch (or in full colour, for reduced motion) as soon as the images arrive.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadImage(HERO_PHOTO.sketch), loadImage(HERO_PHOTO.src)])
      .then(([sketch, photo]) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const ink = new InkPhoto(canvas, sketch, photo, HERO_PHOTO.inkOrigin, 7, HERO_SPREAD);
        inkRef.current = ink;
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        ink.draw(1, still || bloomed.current ? 1 : 0);
        if (still) bloomed.current = true;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Once the site is up, bloom the colour in, once.
  useEffect(() => {
    if (!active || bloomed.current) return;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      const ink = inkRef.current;
      if (!ink) {
        frame = requestAnimationFrame(tick); // images still on their way
        return;
      }
      start ||= now;
      const t = now - start;
      ink.draw(1, windowProgress(t, ...BLOOM));
      if (t < BLOOM[1]) frame = requestAnimationFrame(tick);
      else bloomed.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <figure className="photo-reveal photo-reveal--ink">
      <div className="hero-ink">
        <canvas className="hero-ink__canvas" ref={canvasRef} role="img" aria-label={`${HERO_PHOTO.title}, HKBK College of Engineering`} />
      </div>
      <figcaption className="hero-ink__caption">
        <span>{HERO_PHOTO.label}</span>
        <strong>{HERO_PHOTO.title}</strong>
        <a className="hero-ink__explore" href="/gallery" onClick={onExplore}>
          Explore the gallery <span aria-hidden="true">→</span>
        </a>
      </figcaption>
    </figure>
  );
}
