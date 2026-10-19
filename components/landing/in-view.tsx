"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Whether an element is on screen; true again each time it comes back. */
function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No motion wanted: shown as it is, at once.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const watch = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    watch.observe(el);
    return () => watch.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/**
 * A wrapper that is marked "in" while it's on screen (class "is-in"), and unmarked when
 * it's scrolled away, so what's inside (the charts) can grow in each time it's reached.
 */
export function InView({ className = "", children }: { className?: string; children: ReactNode }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className={`${className} ${inView ? "is-in" : ""}`}>
      {children}
    </div>
  );
}

/** A number that counts up from nought when it comes on screen (and again when it comes back). */
export function CountUp({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.05);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!inView) {
      setShown(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Fast at first, settling on the number.
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);
  return (
    <span ref={ref} aria-label={value.toLocaleString("en-IN")}>
      <span aria-hidden="true">{shown.toLocaleString("en-IN")}</span>
    </span>
  );
}
