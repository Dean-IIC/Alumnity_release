"use client";

import { useEffect, useRef } from "react";
import { COLOUR_SPREAD, SKETCH_SPREAD, windowProgress, type Point } from "../lib/ink";
import { InkPhoto } from "./ink-photo";

/*
 * One photograph in the intro's ink: an irregular splotch straight on the paper. It waits
 * as a pencil sketch and, once `active`, the colour blooms in once, the reveal the intro
 * uses for each era. Then it is still. The hero and every album's cover use this.
 */

/** The colour soaks in over the waiting sketch. */
const BLOOM = [200, 1500] as const;

/*
 * A smaller colour core inside a wide pencil fringe: text laid over the photo's edge sits
 * on its pale sketched rim, never its darkest colour, so it stays readable.
 */
const SPREAD = {
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

type InkBloomProps = {
  src: string;
  sketch: string;
  /** Where the ink lands, as fractions of the photo. */
  origin?: Point;
  /** Seeds the splotch's shape, so each photo has its own and keeps it. */
  seed: number;
  alt: string;
  /** True when the bloom may start (the hero waits for the intro to hand over). */
  active: boolean;
  className?: string;
  /** How far the sketch and colour spread (fractions of the photo's longer side); defaults to the hero's. */
  spread?: { sketch: number; colour: number };
};

export function InkBloom({ src, sketch, origin = { x: 0.5, y: 0.5 }, seed, alt, active, className = "", spread }: InkBloomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<InkPhoto | null>(null);
  const bloomed = useRef(false);

  // Ready as a sketch (or in full colour, for reduced motion) as soon as the images arrive.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadImage(sketch), loadImage(src)])
      .then(([sketchImage, photo]) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const reach = spread
          ? { sketch: { ...SKETCH_SPREAD, extent: spread.sketch }, colour: { ...COLOUR_SPREAD, extent: spread.colour } }
          : SPREAD;
        const ink = new InkPhoto(canvas, sketchImage, photo, origin, seed, reach);
        inkRef.current = ink;
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        ink.draw(1, still || bloomed.current ? 1 : 0);
        if (still) bloomed.current = true;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      inkRef.current?.release();
      inkRef.current = null;
    };
    // origin is usually a literal: its values matter, not its identity.
  }, [src, sketch, seed, origin.x, origin.y, spread?.sketch, spread?.colour]);

  // Once active, bloom the colour in, once.
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

  return <canvas className={`ink-bloom ${className}`} ref={canvasRef} role="img" aria-label={alt} />;
}
