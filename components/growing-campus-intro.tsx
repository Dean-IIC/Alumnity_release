"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAMPUS_BLOCKS } from "../lib/campus";

const INTRO_DURATION_MS = 8000;

type GrowingCampusIntroProps = {
  onComplete: () => void;
};

export function GrowingCampusIntro({ onComplete }: GrowingCampusIntroProps) {
  const [isSettled, setIsSettled] = useState(false);
  const didComplete = useRef(false);

  const settle = useCallback(() => {
    if (didComplete.current) return;
    didComplete.current = true;
    setIsSettled(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return;
    }

    const timer = window.setTimeout(settle, INTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [settle]);

  return (
    <section className={`ink-intro ${isSettled ? "ink-intro--settled" : ""}`} aria-label="A growing illustration of the HKBK campus">
      <div className="ink-intro__paper" aria-hidden="true" />
      <svg className="ink-route" viewBox="0 0 1000 520" aria-hidden="true">
        <path d="M836 214C785 167 720 178 668 260S560 308 503 249 397 205 326 305 206 357 136 274" />
        <circle className="route-beacon" r="8">
          <animateMotion
            begin="760ms"
            dur="5600ms"
            fill="freeze"
            path="M836 214C785 167 720 178 668 260S560 308 503 249 397 205 326 305 206 357 136 274"
          />
        </circle>
        <circle className="route-beacon__core" r="2.5">
          <animateMotion
            begin="760ms"
            dur="5600ms"
            fill="freeze"
            path="M836 214C785 167 720 178 668 260S560 308 503 249 397 205 326 305 206 357 136 274"
          />
        </circle>
      </svg>
      <div className="ink-campus" aria-hidden="true">
        {CAMPUS_BLOCKS.map((block, index) => (
          <figure
            className={`ink-block ink-block--${block.id}`}
            data-block={block.id}
            key={block.id}
            style={{
              "--x": `${block.x}%`,
              "--y": `${block.y}%`,
              "--delay": `${1000 + index * 1180}ms`
            } as React.CSSProperties}
          >
            <span className="ink-block__terrain" />
            <span className="ink-block__terrain ink-block__terrain--inner" />
            <span className="ink-block__leaves" />
            <img className="ink-block__drawing" alt="" src={block.illustration} />
            <img className="ink-block__real" alt="" src={block.realImage} />
          </figure>
        ))}
      </div>
      {!isSettled && <button className="ink-intro__skip" type="button" onClick={settle}>Skip intro <span aria-hidden="true">→</span></button>}
    </section>
  );
}
