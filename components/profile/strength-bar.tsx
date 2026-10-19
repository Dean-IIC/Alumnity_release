"use client";

import { useEffect, useRef } from "react";

/*
 * The bar itself: it fills from empty the first time it comes into view (only where the
 * reader hasn't asked for less motion; app/styles/strength.css waits for "go"). Without
 * scripts, or with less motion asked for, it's simply drawn full.
 */
export function StrengthBar({ percent, label, complete }: { percent: number; label: string; complete: boolean }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const go = () => el.setAttribute("data-fill", "go");
    if (!("IntersectionObserver" in window)) return go();
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        go();
        seen.disconnect();
      }
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  return (
    <div
      ref={bar}
      className={`strength__bar${complete ? " strength__bar--complete" : ""}`}
      role="progressbar"
      aria-label="Profile strength"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%, ${label}`}
    >
      <span className="strength__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
