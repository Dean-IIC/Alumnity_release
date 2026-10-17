"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * As on LinkedIn: once a page's top (the name, the buttons) has scrolled away, a slim bar
 * slides down under the app bar with the name and the same buttons, so they're never far.
 * It watches the page's header (`.profile__top`); hidden from screen readers, which have
 * the real ones.
 */
export function StickyName({ name, children }: { name: string; children?: ReactNode }) {
  const [shown, setShown] = useState(false);
  // Just under the app bar, however tall it is on this screen.
  const [under, setUnder] = useState<number | undefined>(undefined);
  useEffect(() => {
    const top = document.querySelector(".profile__top");
    if (!top) return;
    const measure = () => setUnder(document.querySelector(".app-bar")?.getBoundingClientRect().height);
    measure();
    window.addEventListener("resize", measure);
    const watch = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    watch.observe(top);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div className={`sticky-name ${shown ? "sticky-name--shown" : ""}`} style={under ? { top: under } : undefined} aria-hidden="true" inert={!shown}>
      <div className="sticky-name__inner container">
        <strong className="sticky-name__name">{name}</strong>
        {children && <div className="sticky-name__actions">{children}</div>}
        <button type="button" className="sticky-name__top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          ↑ Top
        </button>
      </div>
    </div>
  );
}
