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
      <div className="ink-drop" aria-hidden="true"><span /></div>
      <svg className="ink-route" viewBox="0 0 1000 520" aria-hidden="true">
        <path d="M836 162C780 212 735 214 670 238S552 268 500 291 398 318 328 340 209 364 136 388" />
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
            <span className="ink-block__leaves" />
            <img alt="" src={block.illustration} />
          </figure>
        ))}
      </div>
      {!isSettled && <button className="ink-intro__skip" type="button" onClick={settle}>Skip intro <span aria-hidden="true">→</span></button>}
    </section>
  );
}
