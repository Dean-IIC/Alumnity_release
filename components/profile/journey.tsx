"use client";

import type { CSSProperties } from "react";
import { InkBloom } from "../ink-bloom";
import { InkSeal } from "./ink-seal";

/*
 * A member's journey since HKBK, drawn the way the intro draws the college's years: the
 * campus as it was when they joined, in pencil that blooms into colour, their seal pressed
 * on it like a postage stamp, and from it the red pen line running through every stop on
 * their way (joined, graduated, whatever they've added, now), each blooming in as the pen
 * reaches it. Under a golden-hour sky, with a few leaves on the wind. Drawn once, then still.
 */

export type Stop = { year: string; title: string; detail?: string; prompt?: boolean };

export type Then = { src: string; sketch: string; year: number; title: string };

/** Where the pen draws: a 1000 × 260 road, stops evenly along it, gently up and down. */
const W = 1000;
const H = 260;

function road(count: number) {
  const points = Array.from({ length: count }, (_, i) => ({ x: ((i + 0.5) / count) * W, y: i % 2 ? 150 : 82 }));
  const all = [{ x: 0, y: 130 }, ...points, { x: W, y: points.length % 2 ? 120 : 100 }];
  // Smooth through every point (Catmull-Rom, as Bézier curves).
  let d = `M${all[0].x} ${all[0].y}`;
  for (let i = 0; i < all.length - 1; i++) {
    const p0 = all[i - 1] ?? all[i];
    const p1 = all[i];
    const p2 = all[i + 1];
    const p3 = all[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return { d, points };
}

export function Journey({ stops, then, sealName = "", sealRing = "", seed = 0 }: { stops: Stop[]; then?: Then; sealName?: string; sealRing?: string; seed?: number }) {
  const { d, points } = road(stops.length);
  return (
    <section className={`journey ${then ? "" : "journey--road-only"}`} aria-label="Their journey since HKBK">
      <div className="journey__sky" aria-hidden="true">
        <span className="journey__cloud journey__cloud--a" />
        <span className="journey__cloud journey__cloud--b" />
        {[0, 1, 2, 3].map((i) => (
          <svg key={i} className="journey__leaf" viewBox="-4 -24 78 32" style={{ "--i": i } as CSSProperties}>
            <path d="M0 0c18 -22 52 -24 70 -6c-20 20 -52 22 -70 6zM0 0l58 -8" />
          </svg>
        ))}
      </div>

      {then && (
        <figure className="journey__then">
          <div className="journey__photo">
            <InkBloom src={then.src} sketch={then.sketch} seed={seed + 3} alt={`HKBK College of Engineering around ${then.year}`} active spread={{ sketch: 0.58, colour: 0.46 }} />
          </div>
          <div className="journey__stamp">
            <InkSeal name={sealName} ring={sealRing} seed={seed} size={112} />
          </div>
          <figcaption>
            HKBK, around {then.year}
            <span>{then.title}</span>
          </figcaption>
        </figure>
      )}

      <div className="journey__road">
        <svg className="journey__line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="journey__line-bleed" d={d} pathLength={1} />
          <path className="journey__line-ink" d={d} pathLength={1} />
        </svg>
        <ol className="journey__stops">
          {stops.map((stop, i) => (
            <li
              key={`${stop.year}-${i}`}
              className={`journey__stop ${stop.prompt ? "journey__stop--prompt" : ""}`}
              style={{ "--x": points[i].x / W, "--y": points[i].y / H } as CSSProperties}
            >
              <span className="journey__dot" aria-hidden="true" />
              <span className="journey__year">{stop.year}</span>
              <span className="journey__title">{stop.title}</span>
              {stop.detail && <span className="journey__detail">{stop.detail}</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
